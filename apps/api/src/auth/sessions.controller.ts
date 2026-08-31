import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from "@nestjs/common";
import { CurrentAuth } from "./current-auth.decorator";
import type { AuthenticatedIdentity } from "./auth.types";
import { PrivyAuthGuard } from "./privy-auth.guard";
import { PrivySessionsService } from "./privy-sessions.service";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AccountSessionResponseDto, ApiErrorResponseDto, RevokeSessionsResponseDto } from "../openapi/openapi.models";

@Controller("sessions")
@UseGuards(PrivyAuthGuard)
@ApiTags("Sessions")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: "Missing, invalid, expired, or revoked Privy session.",
})
export class SessionsController {
  constructor(private readonly sessions: PrivySessionsService) {}

  @Get()
  @ApiOperation({
    summary: "List active sessions",
    description: "Lists API-observed active Privy sessions and marks the current one.",
  })
  @ApiOkResponse({ type: [AccountSessionResponseDto] })
  list(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.sessions.list(auth.privyUserId, auth.sessionId);
  }

  @Delete()
  @ApiOperation({
    summary: "Revoke all other sessions",
    description: "Revokes every active API-observed session except the token making this request.",
  })
  @ApiOkResponse({ type: RevokeSessionsResponseDto })
  revokeOthers(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.sessions.revokeOthers(auth.privyUserId, auth.sessionId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Revoke one session",
    description: "Revokes an active session owned by the authenticated Privy identity.",
  })
  @ApiParam({ name: "id", description: "Privy session identifier from the session list." })
  @ApiNoContentResponse({ description: "Session revoked." })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Malformed or excessively long session ID." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: "Active session not found." })
  revoke(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.sessions.revoke(auth.privyUserId, id);
  }
}
