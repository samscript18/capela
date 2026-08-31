import { INVESTIGATION_STATUSES, type InvestigationStatus } from "@capela/shared";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";

@Schema({ _id: false })
export class InvestigationProgress {
  @Prop({ default: "Investigation queued" }) message!: string;
  @Prop({ default: 0, min: 0 }) papersDiscovered!: number;
  @Prop({ default: 0, min: 0 }) papersSelected!: number;
  @Prop({ default: 0, min: 0 }) papersAnalyzed!: number;
  @Prop({ default: 0, min: 0 }) experimentalFindings!: number;
  @Prop({ default: 0, min: 0 }) computationalFindings!: number;
  @Prop({ default: 0, min: 0 }) targetsEvaluated!: number;
}

@Schema({ _id: false })
export class InvestigationAccess {
  @Prop({ required: true, enum: ["free", "paid"] }) type!: "free" | "paid";
  @Prop({ type: MongooseSchema.Types.ObjectId }) paymentId?: Types.ObjectId;
}

@Schema({ collection: "investigations", timestamps: true, versionKey: false })
export class Investigation {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 200 }) originalInput!: string;
  @Prop({ required: true, enum: INVESTIGATION_STATUSES, default: "queued", index: true }) status!: InvestigationStatus;
  @Prop({ type: SchemaFactory.createForClass(InvestigationProgress), default: () => ({}) })
  progress!: InvestigationProgress;
  @Prop({ type: MongooseSchema.Types.Mixed }) molecule?: Record<string, unknown>;
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) papers!: Record<string, unknown>[];
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) paperEvidence!: Record<string, unknown>[];
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) evidence!: Record<string, unknown>[];
  @Prop({ type: MongooseSchema.Types.Mixed }) analysis?: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed }) mechanism?: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed }) dossier?: Record<string, unknown>;
  @Prop({ type: MongooseSchema.Types.Mixed }) assessment?: Record<string, unknown>;
  @Prop({ type: SchemaFactory.createForClass(InvestigationAccess), required: true }) access!: InvestigationAccess;
  @Prop({ type: Boolean }) activeFreeSlot?: boolean;
  @Prop({ type: MongooseSchema.Types.Mixed }) error?: { code: string; message: string };
  @Prop() startedAt?: Date;
  @Prop() completedAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
}

export type InvestigationDocument = HydratedDocument<Investigation>;
export const InvestigationSchema = SchemaFactory.createForClass(Investigation);
InvestigationSchema.index({ userId: 1, createdAt: -1 });
InvestigationSchema.index(
  { userId: 1, activeFreeSlot: 1 },
  { unique: true, partialFilterExpression: { activeFreeSlot: true } },
);
