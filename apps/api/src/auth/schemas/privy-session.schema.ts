import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ collection: "sessions", timestamps: true, versionKey: false })
export class PrivySession {
  @Prop({ required: true, trim: true }) privyUserId!: string;
  @Prop({ required: true, trim: true }) sessionId!: string;
  @Prop({ trim: true }) deviceName?: string;
  @Prop({ trim: true }) platform?: string;
  @Prop({ trim: true }) browser?: string;
  @Prop({ trim: true, maxlength: 512 }) userAgentSummary?: string;
  @Prop({ required: true }) tokenIssuedAt!: Date;
  @Prop({ required: true }) lastUsedAt!: Date;
  @Prop({ required: true }) expiresAt!: Date;
  @Prop() revokedAt?: Date;
  @Prop({ trim: true }) revokedReason?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export type PrivySessionDocument = HydratedDocument<PrivySession>;
export const PrivySessionSchema = SchemaFactory.createForClass(PrivySession);

PrivySessionSchema.index({ privyUserId: 1, sessionId: 1 }, { unique: true });
PrivySessionSchema.index({ privyUserId: 1, revokedAt: 1, lastUsedAt: -1 });
