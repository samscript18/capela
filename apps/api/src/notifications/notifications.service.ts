import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Investigation, type InvestigationDocument } from "../investigations/schemas/investigation.schema";
import { UsersService } from "../users/users.service";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import {
  NOTIFICATION_TYPES,
  Notification,
  type NotificationDocument,
  type NotificationType,
} from "./schemas/notification.schema";

type TerminalInvestigation = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  originalInput: string;
  status: string;
  molecule?: Record<string, unknown>;
  error?: { code: string; message: string };
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly notifications: Model<NotificationDocument>,
    @InjectModel(Investigation.name) private readonly investigations: Model<InvestigationDocument>,
    private readonly users: UsersService,
  ) {}

  async recordInvestigation(investigation: TerminalInvestigation) {
    if (investigation.status !== "completed" && investigation.status !== "failed") return null;

    const completed = investigation.status === "completed";
    const type: NotificationType = completed ? "INVESTIGATION_COMPLETED" : "INVESTIGATION_FAILED";
    const name = this.moleculeName(investigation);
    const investigationId = investigation._id.toString();
    const idempotencyReference = `investigation:${investigationId}:${investigation.status}`;
    return this.notifications
      .findOneAndUpdate(
        { userId: investigation.userId, idempotencyReference },
        {
          $setOnInsert: {
            userId: investigation.userId,
            type,
            title: completed ? "Dossier ready" : "Investigation needs attention",
            message: completed
              ? `Capela finished the evidence dossier for ${name}.`
              : `The ${name} investigation could not be completed. Review the case before retrying.`,
            actionUrl: `/dashboard/investigations/${encodeURIComponent(investigationId)}`,
            metadata: {
              investigationId,
              molecule: name,
              ...(investigation.error?.code ? { failureCode: investigation.error.code } : {}),
            },
            idempotencyReference,
            emailStatus: "NOT_CONFIGURED",
            emailAttempts: 0,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      )
      .lean()
      .exec();
  }

  async list(privyUserId: string, query: ListNotificationsDto) {
    const user = await this.users.ensureUser(privyUserId);
    await this.syncTerminalInvestigations(user._id);
    const filter: Record<string, unknown> = {
      userId: user._id,
      deletedAt: { $exists: false },
    };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.notifications
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .select("-userId -idempotencyReference -deletedAt")
      .lean()
      .exec();
    const hasNextPage = rows.length > query.limit;
    const data = rows.slice(0, query.limit);
    return {
      data,
      pagination: {
        nextCursor: hasNextPage ? data.at(-1)?._id.toString() : null,
        previousCursor: null,
        hasNextPage,
        limit: query.limit,
      },
    };
  }

  async unreadCount(privyUserId: string) {
    const user = await this.users.ensureUser(privyUserId);
    await this.syncTerminalInvestigations(user._id);
    const unreadCount = await this.notifications.countDocuments({
      userId: user._id,
      readAt: { $exists: false },
      deletedAt: { $exists: false },
    });
    return { unreadCount };
  }

  async markRead(privyUserId: string, id: string) {
    this.assertObjectId(id);
    const user = await this.users.ensureUser(privyUserId);
    const notification = await this.notifications
      .findOneAndUpdate(
        { _id: id, userId: user._id, deletedAt: { $exists: false } },
        { $set: { readAt: new Date() } },
        { returnDocument: "after" },
      )
      .select("-userId -idempotencyReference -deletedAt")
      .lean()
      .exec();
    if (!notification) throw new NotFoundException("Notification not found");
    return notification;
  }

  async markAllRead(privyUserId: string) {
    const user = await this.users.ensureUser(privyUserId);
    await this.syncTerminalInvestigations(user._id);
    const result = await this.notifications.updateMany(
      { userId: user._id, readAt: { $exists: false }, deletedAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );
    return { updatedCount: result.modifiedCount };
  }

  async remove(privyUserId: string, id: string) {
    this.assertObjectId(id);
    const user = await this.users.ensureUser(privyUserId);
    const result = await this.notifications.updateOne(
      { _id: id, userId: user._id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
    );
    if (!result.modifiedCount) throw new NotFoundException("Notification not found");
  }

  async deleteInvestigationNotifications(privyUserId: string) {
    const user = await this.users.ensureUser(privyUserId);
    const result = await this.notifications.updateMany(
      {
        userId: user._id,
        type: { $in: [...NOTIFICATION_TYPES] },
        deletedAt: { $exists: false },
      },
      { $set: { deletedAt: new Date() } },
    );
    return { deletedCount: result.modifiedCount };
  }

  private async syncTerminalInvestigations(userId: Types.ObjectId) {
    const terminal = await this.investigations
      .find({ userId, status: { $in: ["completed", "failed"] } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .exec();
    await Promise.all(terminal.map((investigation) => this.recordInvestigation(investigation)));
  }

  private moleculeName(investigation: TerminalInvestigation) {
    const preferredName = investigation.molecule?.preferredName;
    return typeof preferredName === "string" && preferredName.trim()
      ? preferredName.trim()
      : investigation.originalInput;
  }

  private assertObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid notification ID");
  }
}
