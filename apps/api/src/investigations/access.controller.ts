import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { InvestigationsService } from "./investigations.service";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AccessResponseDto, ApiErrorResponseDto } from "../openapi/openapi.models";

@Controller("access")
@UseGuards(PrivyAuthGuard)
@ApiTags("Access")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class AccessController {
  constructor(private readonly investigations: InvestigationsService) {}
  @Get()
  @ApiOperation({
    summary: "Get investigation access state",
    description:
      "Returns the authoritative preview/free allowance and payment state. Allowances reset at 00:00 UTC and only successful free investigations count.",
  })
  @ApiOkResponse({ type: AccessResponseDto })
  getAccess(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.investigations.access(auth.privyUserId);
  }
}
