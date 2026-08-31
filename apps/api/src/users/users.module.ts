import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Investigation, InvestigationSchema } from "../investigations/schemas/investigation.schema";
import { Notification, NotificationSchema } from "../notifications/schemas/notification.schema";
import { Payment, PaymentSchema } from "../payments/schemas/payment.schema";
import { CloudinaryAvatarService } from "./cloudinary-avatar.service";
import { User, UserSchema } from "./schemas/user.schema";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Investigation.name, schema: InvestigationSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [CloudinaryAvatarService, UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
