import { ACTIVE_INVESTIGATION_STATUSES } from "@capela/shared";
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { UsersService } from "../users/users.service";
import { InvestigationRunnerService } from "../research/investigation-runner.service";
import { PaymentsService } from "../payments/payments.service";
import { CreateInvestigationDto } from "./dto/create-investigation.dto";
import { ListInvestigationsDto } from "./dto/list-investigations.dto";
import { Investigation, type InvestigationDocument } from "./schemas/investigation.schema";

const DAILY_FREE_INVESTIGATION_LIMIT = 3;

@Injectable()
export class InvestigationsService {
  constructor(
    @InjectModel(Investigation.name) private readonly investigations: Model<InvestigationDocument>,
    private readonly users: UsersService,
    private readonly config: ConfigService,
    private readonly runner: InvestigationRunnerService,
    private readonly payments: PaymentsService,
  ) {}

  async access(privyUserId: string) {
    const user = await this.users.ensureUser(privyUserId);
    const free = await this.dailyFreeAccess(user._id);
    const paymentsEnabled = this.paymentsEnabled();
    const activeFree = await this.investigations.exists({
      userId: user._id,
      "access.type": "free",
      status: { $in: ACTIVE_INVESTIGATION_STATUSES },
    });
    const freeInvestigationAvailable = (free.remaining > 0 || !paymentsEnabled) && !activeFree;
    const paymentRequired = paymentsEnabled && free.remaining === 0;
    const verifiedPaymentId = paymentRequired ? await this.payments.availablePaymentId(user._id) : undefined;
    const paymentReceiverAddress = paymentsEnabled
      ? this.config.get<string>("PAYMENT_RECEIVER_ADDRESS") || undefined
      : undefined;
    return {
      paymentsEnabled,
      unlimitedInvestigations: !paymentsEnabled,
      freeInvestigationAvailable,
      freeInvestigationsLimit: DAILY_FREE_INVESTIGATION_LIMIT,
      freeInvestigationsUsedToday: free.used,
      freeInvestigationsRemaining: free.remaining,
      freeInvestigationsResetAt: free.resetAt.toISOString(),
      paymentRequired,
      priceWei: paymentsEnabled ? (this.config.get<string>("INVESTIGATION_PRICE_WEI") ?? "0") : "0",
      chainId: Number(this.config.get<string>("BASE_CHAIN_ID") ?? 84532),
      ...(paymentReceiverAddress ? { paymentReceiverAddress } : {}),
      ...(verifiedPaymentId ? { verifiedPaymentId } : {}),
    };
  }

  async create(privyUserId: string, input: CreateInvestigationDto) {
    const user = await this.users.ensureUser(privyUserId);
    const originalInput = input.originalInput.trim();
    const escapedInput = originalInput.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const completed = await this.investigations
      .findOne({
        userId: user._id,
        status: "completed",
        dossier: { $exists: true, $ne: null },
        $or: [
          { originalInput: { $regex: `^${escapedInput}$`, $options: "i" } },
          { "molecule.preferredName": { $regex: `^${escapedInput}$`, $options: "i" } },
        ],
      })
      .sort({ completedAt: -1 })
      .exec();
    if (completed) return completed;

    const free = await this.dailyFreeAccess(user._id);
    let investigation;
    if (this.paymentsEnabled() && free.remaining === 0) {
      if (!input.paymentId)
        throw new HttpException(
          { message: "A verified Base payment is required", code: "PAYMENT_REQUIRED" },
          HttpStatus.PAYMENT_REQUIRED,
        );
      const investigationId = new Types.ObjectId();
      const payment = await this.payments.consume(user._id, input.paymentId, investigationId);
      try {
        investigation = await this.investigations.create({
          _id: investigationId,
          userId: user._id,
          originalInput,
          status: "queued",
          progress: { message: "Investigation queued" },
          access: { type: "paid", paymentId: payment._id },
        });
      } catch (error) {
        await this.payments.release(input.paymentId, investigationId);
        throw error;
      }
    } else {
      const activeFree = await this.investigations.exists({
        userId: user._id,
        "access.type": "free",
        status: { $in: ACTIVE_INVESTIGATION_STATUSES },
      });
      if (activeFree)
        throw new HttpException(
          { message: "A free investigation is already active", code: "FREE_INVESTIGATION_ACTIVE" },
          HttpStatus.CONFLICT,
        );
      try {
        investigation = await this.investigations.create({
          userId: user._id,
          originalInput,
          status: "queued",
          progress: { message: "Investigation queued" },
          access: { type: "free" },
          activeFreeSlot: true,
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000)
          throw new HttpException(
            { message: "A free investigation is already active", code: "FREE_INVESTIGATION_ACTIVE" },
            HttpStatus.CONFLICT,
          );
        throw error;
      }
    }
    void this.runner.run(investigation.id);
    return investigation;
  }

  async list(privyUserId: string, query: ListInvestigationsDto) {
    const user = await this.users.ensureUser(privyUserId);
    const filter: Record<string, unknown> = { userId: user._id };
    if (query.status) filter.status = query.status;
    return this.investigations.find(filter).sort({ createdAt: -1 }).limit(100).lean().exec();
  }

  async get(privyUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid investigation ID");
    const user = await this.users.ensureUser(privyUserId);
    const investigation = await this.investigations.findOne({ _id: id, userId: user._id }).lean().exec();
    if (!investigation) throw new NotFoundException("Investigation not found");
    return investigation;
  }

  async remove(privyUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid investigation ID");
    const user = await this.users.ensureUser(privyUserId);
    const investigation = await this.investigations.findOneAndDelete({ _id: id, userId: user._id }).lean().exec();
    if (!investigation) throw new NotFoundException("Investigation not found");

    if (investigation.status !== "completed" && investigation.access.type === "paid" && investigation.access.paymentId)
      await this.payments.release(investigation.access.paymentId.toString(), investigation._id);

    return { deleted: true as const, investigationId: id };
  }

  async retry(privyUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid investigation ID");
    const user = await this.users.ensureUser(privyUserId);
    const failed = await this.investigations.findOne({ _id: id, userId: user._id }).lean().exec();
    if (!failed) throw new NotFoundException("Investigation not found");
    if (failed.status !== "failed")
      throw new HttpException(
        { message: "Only failed investigations can be retried", code: "INVESTIGATION_NOT_FAILED" },
        HttpStatus.CONFLICT,
      );

    if (failed.access.type === "free") {
      const activeFree = await this.investigations.exists({
        userId: user._id,
        _id: { $ne: failed._id },
        "access.type": "free",
        status: { $in: ACTIVE_INVESTIGATION_STATUSES },
      });
      if (activeFree)
        throw new HttpException(
          { message: "A free investigation is already active", code: "FREE_INVESTIGATION_ACTIVE" },
          HttpStatus.CONFLICT,
        );
    }

    try {
      const retried = await this.investigations
        .findOneAndUpdate(
          { _id: failed._id, userId: user._id, status: "failed" },
          {
            $set: {
              status: "queued",
              progress: { message: "Investigation queued for retry" },
              ...(failed.access.type === "free" ? { activeFreeSlot: true } : {}),
            },
            $unset: {
              molecule: 1,
              papers: 1,
              paperEvidence: 1,
              evidence: 1,
              analysis: 1,
              mechanism: 1,
              dossier: 1,
              assessment: 1,
              error: 1,
              startedAt: 1,
              completedAt: 1,
            },
          },
          { returnDocument: "after" },
        )
        .exec();
      if (!retried)
        throw new HttpException(
          { message: "Investigation retry is already in progress", code: "INVESTIGATION_RETRY_CONFLICT" },
          HttpStatus.CONFLICT,
        );
      void this.runner.run(retried.id);
      return retried;
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new HttpException(
          { message: "A free investigation is already active", code: "FREE_INVESTIGATION_ACTIVE" },
          HttpStatus.CONFLICT,
        );
      throw error;
    }
  }

  async deleteHistory(privyUserId: string) {
    const user = await this.users.ensureUser(privyUserId);
    const result = await this.investigations.deleteMany({ userId: user._id }).exec();
    return { deletedCount: result.deletedCount };
  }

  private async dailyFreeAccess(userId: Types.ObjectId) {
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const resetAt = new Date(start);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
    const used = await this.investigations.countDocuments({
      userId,
      "access.type": "free",
      status: "completed",
      completedAt: { $gte: start, $lt: resetAt },
    });
    return { used, remaining: Math.max(0, DAILY_FREE_INVESTIGATION_LIMIT - used), resetAt };
  }

  private paymentsEnabled() {
    return this.config.get<string>("PAYMENTS_ENABLED") === "true";
  }
}
