import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { Payment, PaymentSchema } from "./schemas/payment.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]), AuthModule, UsersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [MongooseModule, PaymentsService],
})
export class PaymentsModule {}
