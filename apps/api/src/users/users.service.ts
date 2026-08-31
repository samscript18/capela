import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PrivyAuthService } from "../auth/privy-auth.service";
import { PrivySession, type PrivySessionDocument } from "../auth/schemas/privy-session.schema";
import { Investigation, type InvestigationDocument } from "../investigations/schemas/investigation.schema";
import { Notification, type NotificationDocument } from "../notifications/schemas/notification.schema";
import { Payment, type PaymentDocument } from "../payments/schemas/payment.schema";
import { type AvatarUploadFile } from "./avatar-image";
import { CloudinaryAvatarService } from "./cloudinary-avatar.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User, type UserDocument } from "./schemas/user.schema";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Investigation.name) private readonly investigations: Model<InvestigationDocument>,
    @InjectModel(Notification.name) private readonly notifications: Model<NotificationDocument>,
    @InjectModel(Payment.name) private readonly payments: Model<PaymentDocument>,
    @InjectModel(PrivySession.name) private readonly sessions: Model<PrivySessionDocument>,
    private readonly avatars: CloudinaryAvatarService,
    private readonly privy: PrivyAuthService,
  ) {}

  async ensureUser(
    privyUserId: string,
    profile?: { email?: string; displayName?: string; avatarUrl?: string; primaryWalletAddress?: string },
  ) {
    const trustedProfile = Object.fromEntries(
      Object.entries(profile ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
      ),
    );
    const { displayName, ...refreshedProfile } = trustedProfile;
    const existingUser = await this.users.findOne({ privyUserId }).select("+avatarPublicId").lean().exec();
    if (existingUser?.avatarPublicId) delete refreshedProfile.avatarUrl;
    return this.users
      .findOneAndUpdate(
        { privyUserId },
        {
          $set: refreshedProfile,
          $setOnInsert: {
            privyUserId,
            ...(displayName ? { displayName } : {}),
            preferences: { compactEvidence: false, openEvidenceInDrawer: true },
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      )
      .lean()
      .orFail()
      .exec();
  }

  update(privyUserId: string, input: UpdateUserDto) {
    const set: Record<string, string | boolean> = {};
    const unset: Record<string, 1> = {};
    if (Object.hasOwn(input, "displayName")) {
      const displayName = input.displayName?.trim();
      if (displayName) set.displayName = displayName;
      else unset.displayName = 1;
    }
    if (input.preferences?.compactEvidence !== undefined)
      set["preferences.compactEvidence"] = input.preferences.compactEvidence;
    if (input.preferences?.openEvidenceInDrawer !== undefined)
      set["preferences.openEvidenceInDrawer"] = input.preferences.openEvidenceInDrawer;
    const update = {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    };
    return this.users.findOneAndUpdate({ privyUserId }, update, { returnDocument: "after" }).lean().orFail().exec();
  }

  async updateAvatar(privyUserId: string, file: AvatarUploadFile) {
    const existingUser = await this.users.findOne({ privyUserId }).select("+avatarPublicId").lean().exec();
    const uploaded = await this.avatars.upload(file, privyUserId);
    try {
      const updatedUser = await this.users
        .findOneAndUpdate(
          { privyUserId },
          {
            $set: { avatarPublicId: uploaded.publicId, avatarUrl: uploaded.secureUrl },
            $setOnInsert: {
              privyUserId,
              preferences: { compactEvidence: false, openEvidenceInDrawer: true },
            },
          },
          { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
        )
        .lean()
        .orFail()
        .exec();

      if (existingUser?.avatarPublicId && existingUser.avatarPublicId !== uploaded.publicId) {
        try {
          await this.avatars.delete(existingUser.avatarPublicId);
        } catch {
          this.logger.warn("A replaced Cloudinary avatar could not be removed; the new profile image remains active");
        }
      }
      return updatedUser;
    } catch (error) {
      try {
        await this.avatars.delete(uploaded.publicId);
      } catch {
        this.logger.warn("A newly uploaded avatar could not be rolled back after the profile update failed");
      }
      throw error;
    }
  }

  async deleteAccount(privyUserId: string) {
    const user = await this.users.findOne({ privyUserId }).select("+avatarPublicId").lean().exec();
    if (user?.avatarPublicId) await this.avatars.delete(user.avatarPublicId);

    if (user?._id) {
      await this.notifications.deleteMany({ userId: user._id }).exec();
      await this.payments.deleteMany({ userId: user._id }).exec();
      await this.investigations.deleteMany({ userId: user._id }).exec();
    }
    await this.sessions.deleteMany({ privyUserId }).exec();
    await this.users.deleteOne({ privyUserId }).exec();
    await this.privy.deleteUser(privyUserId);
    return { deleted: true } as const;
  }
}
