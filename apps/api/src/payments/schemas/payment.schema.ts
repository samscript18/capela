import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { Investigation } from "../../investigations/schemas/investigation.schema";
import { User } from "../../users/schemas/user.schema";

@Schema({ collection: "payments", timestamps: true, versionKey: false })
export class Payment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true }) userId!: Types.ObjectId;
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true }) transactionHash!: string;
  @Prop({ required: true }) chainId!: number;
  @Prop({ required: true, lowercase: true, trim: true }) from!: string;
  @Prop({ required: true, lowercase: true, trim: true }) to!: string;
  @Prop({ required: true }) amountWei!: string;
  @Prop({ required: true, enum: ["verified", "consumed"] }) status!: "verified" | "consumed";
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Investigation.name }) investigationId?: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
