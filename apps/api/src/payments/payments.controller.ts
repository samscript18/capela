import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(PrivyAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("verify")
  verify(@CurrentAuth() auth: AuthenticatedIdentity, @Body() input: VerifyPaymentDto) {
    return this.payments.verify(auth.privyUserId, input.transactionHash);
  }
}
