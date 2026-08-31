import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";

export const NOTIFICATION_TYPES = ["INVESTIGATION_COMPLETED", "INVESTIGATION_FAILED"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Schema({ collection: "notifications", timestamps: true, versionKey: false })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: NOTIFICATION_TYPES, index: true })
  type!: NotificationType;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ trim: true })
  actionUrl?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  metadata!: Record<string, unknown>;

  @Prop({ required: true })
  idempotencyReference!: string;

  @Prop()
  readAt?: Date;

  @Prop()
  deletedAt?: Date;

  @Prop({ required: true, default: "NOT_CONFIGURED" })
  emailStatus!: string;

  @Prop({ required: true, default: 0, min: 0 })
  emailAttempts!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, idempotencyReference: 1 }, { unique: true });
NotificationSchema.index({ userId: 1, createdAt: -1, _id: -1 });
