import type { PaymentVerificationResponse } from "@capela/shared";
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { createPublicClient, http, isAddress, type Hash, type PublicClient } from "viem";
import { PrivyAuthService } from "../auth/privy-auth.service";
import { UsersService } from "../users/users.service";
import { Payment, type PaymentDocument } from "./schemas/payment.schema";

@Injectable()
export class PaymentsService {
  private readonly client: PublicClient;

  constructor(
    @InjectModel(Payment.name) private readonly payments: Model<PaymentDocument>,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly privy: PrivyAuthService,
  ) {
    this.client = createPublicClient({ transport: http(this.config.get<string>("BASE_RPC_URL") || undefined) });
  }

  async verify(privyUserId: string, transactionHash: Hash): Promise<PaymentVerificationResponse> {
    if (this.config.get<string>("PAYMENTS_ENABLED") !== "true")
      throw new ServiceUnavailableException({
        message: "Payments are temporarily disabled",
        code: "PAYMENTS_DISABLED",
      });
    const walletAddresses = await this.privy.getEthereumWalletAddresses(privyUserId);
    const user = await this.users.ensureUser(privyUserId, { primaryWalletAddress: walletAddresses[0] });
    const hash = transactionHash.toLowerCase() as Hash;
    const existing = await this.payments.findOne({ transactionHash: hash }).lean().exec();
    if (existing) {
      if (String(existing.userId) !== String(user._id) || existing.status === "consumed")
        throw new ConflictException({
          message: "This transaction has already been used",
          code: "TRANSACTION_ALREADY_USED",
        });
      return this.response(existing);
    }

    const expectedChainId = this.numberConfig("BASE_CHAIN_ID", 84532);
    const requiredAmount = this.bigIntConfig("INVESTIGATION_PRICE_WEI");
    const minimumConfirmations = this.numberConfig("BASE_MIN_CONFIRMATIONS", 1);
    const receiptTimeout = this.numberConfig("BASE_RECEIPT_TIMEOUT_MS", 60_000);
    const receiver = this.config.get<string>("PAYMENT_RECEIVER_ADDRESS")?.trim();
    if (!this.config.get<string>("BASE_RPC_URL") || !receiver || !isAddress(receiver) || requiredAmount <= 0n) {
      throw new ServiceUnavailableException({
        message: "Base payments are not configured",
        code: "PAYMENTS_NOT_CONFIGURED",
      });
    }

    let chainId: number;
    let transaction;
    let receipt;
    try {
      chainId = await this.client.getChainId();
    } catch {
      throw new ServiceUnavailableException({
        message: "The configured Base RPC is unavailable",
        code: "BASE_RPC_UNAVAILABLE",
      });
    }
    if (chainId !== expectedChainId)
      throw new UnprocessableEntityException({
        message: "The transaction is on the wrong network",
        code: "WRONG_CHAIN",
      });
    try {
      receipt = await this.client.waitForTransactionReceipt({
        hash,
        confirmations: minimumConfirmations,
        timeout: receiptTimeout,
      });
      transaction = await this.client.getTransaction({ hash });
    } catch {
      throw new UnprocessableEntityException({
        message: "The Base transaction could not be confirmed",
        code: "TRANSACTION_NOT_CONFIRMED",
      });
    }
    if (receipt.status !== "success")
      throw new UnprocessableEntityException({
        message: "The transaction did not succeed",
        code: "TRANSACTION_FAILED",
      });
    if (!transaction.to || transaction.to.toLowerCase() !== receiver.toLowerCase())
      throw new UnprocessableEntityException({
        message: "The transaction recipient is not Capela",
        code: "INVALID_RECIPIENT",
      });
    if (transaction.value < requiredAmount)
      throw new UnprocessableEntityException({
        message: "The transaction amount is below the investigation price",
        code: "INSUFFICIENT_PAYMENT",
      });
    if (!walletAddresses.includes(transaction.from.toLowerCase()))
      throw new UnprocessableEntityException({
        message: "The paying wallet is not linked to this Privy account",
        code: "UNLINKED_PAYMENT_SENDER",
      });
    const latestBlock = await this.client
      .getBlockNumber()
      .catch(() => receipt.blockNumber + BigInt(minimumConfirmations) - 1n);
    const confirmations = latestBlock >= receipt.blockNumber ? latestBlock - receipt.blockNumber + 1n : 0n;
    if (confirmations < BigInt(minimumConfirmations))
      throw new UnprocessableEntityException({
        message: "The transaction needs more confirmations",
        code: "INSUFFICIENT_CONFIRMATIONS",
      });

    try {
      const payment = await this.payments.create({
        userId: user._id,
        transactionHash: hash,
        chainId,
        from: transaction.from,
        to: transaction.to,
        amountWei: transaction.value.toString(),
        status: "verified",
      });
      return this.response(payment);
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException({
          message: "This transaction has already been used",
          code: "TRANSACTION_ALREADY_USED",
        });
      throw error;
    }
  }

  async availablePaymentId(userId: Types.ObjectId) {
    const payment = await this.payments
      .findOne({ userId, status: "verified" })
      .sort({ createdAt: 1 })
      .select({ _id: 1 })
      .lean()
      .exec();
    return payment?._id.toString();
  }

  async consume(userId: Types.ObjectId, paymentId: string, investigationId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(paymentId))
      throw new ConflictException({ message: "A verified Base payment is required", code: "PAYMENT_REQUIRED" });
    const payment = await this.payments
      .findOneAndUpdate(
        { _id: paymentId, userId, status: "verified", investigationId: { $exists: false } },
        { $set: { status: "consumed", investigationId } },
        { returnDocument: "after" },
      )
      .lean()
      .exec();
    if (!payment)
      throw new ConflictException({
        message: "This payment is unavailable or already consumed",
        code: "PAYMENT_ALREADY_CONSUMED",
      });
    return payment;
  }

  async release(paymentId: string, investigationId: Types.ObjectId) {
    await this.payments
      .updateOne(
        { _id: paymentId, status: "consumed", investigationId },
        { $set: { status: "verified" }, $unset: { investigationId: 1 } },
      )
      .exec();
  }

  private response(payment: {
    _id: unknown;
    transactionHash: string;
    chainId: number;
    from: string;
    to: string;
    amountWei: string;
    status: "verified" | "consumed";
  }): PaymentVerificationResponse {
    return {
      id: String(payment._id),
      transactionHash: payment.transactionHash,
      chainId: payment.chainId,
      from: payment.from,
      to: payment.to,
      amountWei: payment.amountWei,
      status: payment.status,
    };
  }

  private numberConfig(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key) ?? fallback);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }

  private bigIntConfig(key: string) {
    try {
      return BigInt(this.config.get<string>(key) ?? "0");
    } catch {
      return 0n;
    }
  }
}
