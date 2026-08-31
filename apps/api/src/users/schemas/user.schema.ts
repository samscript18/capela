import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class UserPreferences {
  @Prop({ type: Boolean, default: false }) compactEvidence!: boolean;
  @Prop({ type: Boolean, default: true }) openEvidenceInDrawer!: boolean;
}

const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);

@Schema({ collection: "users", timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, unique: true, index: true, trim: true }) privyUserId!: string;
  @Prop({ trim: true, maxlength: 80 }) displayName?: string;
  @Prop({ lowercase: true, trim: true }) email?: string;
  @Prop({ trim: true }) avatarUrl?: string;
  @Prop({ select: false, trim: true }) avatarPublicId?: string;
  @Prop({ lowercase: true, trim: true }) primaryWalletAddress?: string;
  @Prop({ type: UserPreferencesSchema, default: () => ({ compactEvidence: false, openEvidenceInDrawer: true }) })
  preferences!: UserPreferences;
  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
