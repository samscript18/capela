import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { PaymentsService } from "./payments.service";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto, PaymentVerificationResponseDto } from "../openapi/openapi.models";

@Controller("payments")
@UseGuards(PrivyAuthGuard)
@ApiTags("Payments")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("verify")
  @ApiOperation({
    summary: "Verify a Base payment",
    description:
      "When payments are enabled, verifies the receipt, chain, recipient, amount, confirmations, linked Privy wallet sender, and transaction uniqueness before creating an entitlement.",
  })
  @ApiCreatedResponse({
    type: PaymentVerificationResponseDto,
    description: "Transaction verified or an existing unconsumed entitlement returned idempotently.",
  })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: "Transaction belongs to another user or has already been consumed.",
  })
  @ApiResponse({
    status: 422,
    type: ApiErrorResponseDto,
    description:
      "Wrong chain, failed/unconfirmed transaction, invalid recipient, insufficient amount/confirmations, or unlinked sender.",
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorResponseDto,
    description: "Payments are disabled, not configured, or the Base RPC is unavailable.",
  })
  verify(@CurrentAuth() auth: AuthenticatedIdentity, @Body() input: VerifyPaymentDto) {
    return this.payments.verify(auth.privyUserId, input.transactionHash);
  }
}
