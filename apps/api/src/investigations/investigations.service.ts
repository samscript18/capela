import { randomUUID } from "node:crypto";
import { ACTIVE_INVESTIGATION_STATUSES, parseStoredResearchRun } from "@capela/shared";
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
    if (completed) return this.publicRecord(completed);

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
    void this.runner.run(investigation.id).catch(() => undefined);
    return this.publicRecord(investigation);
  }

  async list(privyUserId: string, query: ListInvestigationsDto) {
    const user = await this.users.ensureUser(privyUserId);
    const filter: Record<string, unknown> = { userId: user._id };
    if (query.status) filter.status = query.status;
    return this.investigations
      .find(filter)
      .select("-leaseToken -leaseExpiresAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
  }

  async get(privyUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid investigation ID");
    const user = await this.users.ensureUser(privyUserId);
    const investigation = await this.investigations.findOne({ _id: id, userId: user._id }).lean().exec();
    if (!investigation) throw new NotFoundException("Investigation not found");
    return this.publicRecord(investigation);
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

    const paidRetry = !!failed.research?.budget.calls;
    const reservation = Number(this.config.get<string>("OTARI_CALL_RESERVATION_MICROUSD") || 10000);
    let retryResearch: import("@capela/shared").ResearchRun | undefined;
    let retryMode: "saved_sources" | "restart" | undefined;
    if (paidRetry) {
      let prior: import("@capela/shared").ResearchRun;
      try {
        prior = parseStoredResearchRun(failed.research);
      } catch {
        throw new HttpException(
          {
            code: "INVALID_STORED_RUN",
            message: "Saved budget data could not be validated; retry cannot discard prior charges.",
          },
          HttpStatus.CONFLICT,
        );
      }
      const configuredCap = Number(this.config.get<string>("OTARI_RUN_BUDGET_MICROUSD") ?? prior.budget.capMicrousd);
      const spendingDenied = /SPENDING_DENIED|BUDGET_DENIED|INSUFFICIENT_FUNDS|PRICING_REQUIRED/.test(
        failed.error?.code ?? "",
      );
      if (
        !Number.isSafeInteger(configuredCap) ||
        configuredCap <= 0 ||
        configuredCap > 100000000 ||
        !Number.isSafeInteger(reservation) ||
        reservation <= 0 ||
        reservation > 100000000 ||
        (spendingDenied && configuredCap <= prior.budget.capMicrousd)
      )
        throw new HttpException(
          {
            code: "RETRY_BUDGET_REQUIRED",
            message:
              "Configure a positive run allowance. After a hosted spending denial, raise the authorized allowance and resolve the hosted limit before retrying.",
          },
          HttpStatus.CONFLICT,
        );
      const cap = configuredCap;
      const savedSources =
        !!failed.molecule &&
        !!failed.papers?.length &&
        failed.papers.every((p) => prior.snapshots.some((source) => source.paperId === String(p.id)));
      const resumeReview = savedSources && prior.checkpoint === "extracted" && prior.decisions.length > 0;
      const vertexReview =
        resumeReview &&
        this.config.get<string>("OTARI_REVIEW_FALLBACK") === "vertex" &&
        (prior.reviewRoute === "vertex" ||
          (prior.events.at(-1)?.operation === "review" &&
            (["OTARI_UPSTREAM_TIMEOUT", "OTARI_TRANSPORT_UNCERTAIN"].includes(failed.error?.code ?? "") ||
              (failed.error?.code === "OTARI_PROVIDER_ERROR" &&
                [502, 503, 504].includes(prior.events.at(-1)?.httpStatus ?? 0)))));
      const pendingReviews = prior.decisions.filter((d) => !d.review || d.review.claimId !== d.candidate.id).length;
      const needed = resumeReview
        ? (vertexReview ? Math.ceil(pendingReviews / 2) * 100000 : reservation) + Math.max(10000, reservation)
        : savedSources
          ? (failed.papers.length + 1) * reservation + Math.max(10000, reservation)
          : Math.max(60000, reservation) + 3 * reservation + Math.max(10000, reservation);
      if (cap - prior.budget.reportedMicrousd - prior.budget.reservedMicrousd < needed)
        throw new HttpException(
          {
            code: "RETRY_BUDGET_REQUIRED",
            message:
              "The remaining allowance cannot fund a retry. Increase the configured run allowance; previous charges and uncertain reservations remain counted.",
          },
          HttpStatus.CONFLICT,
        );
      retryMode = savedSources ? "saved_sources" : "restart";
      retryResearch = {
        ...prior,
        runId: randomUUID(),
        snapshots: savedSources ? prior.snapshots : [],
        decisions: resumeReview ? prior.decisions : [],
        events: resumeReview ? prior.events : [],
        models: resumeReview && prior.models.extraction ? { ...prior.models, distinct: false } : { distinct: false },
        budget: {
          ...prior.budget,
          capMicrousd: cap,
          maxCalls: prior.budget.calls + (this.config.get<string>("OTARI_REVIEW_FALLBACK") === "vertex" ? 24 : 16),
          terminal: false,
        },
        dispatchUncertain: false,
        limitations: [
          ...prior.limitations,
          "Explicit retry: prior attempts and all reported charges/unknown reservations are retained. New calls may incur additional charges.",
        ],
      };
      // Mixed BSON fields can turn explicit undefined into null. Omit cleared fields entirely.
      if (resumeReview) retryResearch.checkpoint = "extracted";
      else delete retryResearch.checkpoint;
      delete retryResearch.reviewRoute;
      if (vertexReview) retryResearch.reviewRoute = "vertex";
      delete retryResearch.audit;
    }

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
          {
            _id: failed._id,
            userId: user._id,
            status: "failed",
            ...(failed.updatedAt ? { updatedAt: failed.updatedAt } : {}),
          },
          {
            $set: {
              status: "queued",
              progress: { message: "Investigation queued for retry" },
              ...(retryResearch ? { research: retryResearch, retryMode } : {}),
              ...(failed.access.type === "free" ? { activeFreeSlot: true } : {}),
            },
            ...(retryResearch
              ? {
                  $push: {
                    previousResearchRuns: {
                      research: failed.research,
                      error: failed.error,
                      failedAt: failed.updatedAt,
                    },
                  },
                }
              : {}),
            $unset: {
              ...(!retryResearch ? { retryMode: 1 } : {}),
              ...(retryMode === "restart" ? { molecule: 1, papers: 1 } : {}),
              ...(!paidRetry ? { molecule: 1, papers: 1, research: 1 } : {}),
              paperEvidence: 1,
              evidence: 1,
              analysis: 1,
              mechanism: 1,
              dossier: 1,
              assessment: 1,
              error: 1,
              startedAt: 1,
              completedAt: 1,
              leaseToken: 1,
              leaseExpiresAt: 1,
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
      void this.runner.run(retried.id).catch(() => undefined);
      return this.publicRecord(retried);
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

  async cancel(privyUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid investigation ID");
    const user = await this.users.ensureUser(privyUserId);
    const result = await this.investigations
      .findOneAndUpdate(
        { _id: id, userId: user._id, status: { $in: ACTIVE_INVESTIGATION_STATUSES } },
        {
          $set: {
            status: "failed",
            error: { code: "RUN_CANCELLED", message: "Cancelled. An in-flight request may already have been charged." },
            "progress.message": "Cancelled; saved work remains partial",
          },
          $unset: { leaseToken: 1, leaseExpiresAt: 1, activeFreeSlot: 1 },
        },
        { returnDocument: "after" },
      )
      .lean()
      .exec();
    if (!result) throw new NotFoundException("Active investigation not found");
    return this.publicRecord(result);
  }

  private publicRecord(record: InvestigationDocument | Record<string, unknown>) {
    const value = "toObject" in record && typeof record.toObject === "function" ? record.toObject() : { ...record };
    delete value.leaseToken;
    delete value.leaseExpiresAt;
    return value;
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
