import { Controller, Delete, Get, HttpCode, HttpStatus, Param, UseGuards } from "@nestjs/common";
import { CurrentAuth } from "./current-auth.decorator";
import type { AuthenticatedIdentity } from "./auth.types";
import { PrivyAuthGuard } from "./privy-auth.guard";
import { PrivySessionsService } from "./privy-sessions.service";

@Controller("sessions")
@UseGuards(PrivyAuthGuard)
export class SessionsController {
  constructor(private readonly sessions: PrivySessionsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.sessions.list(auth.privyUserId, auth.sessionId);
  }

  @Delete()
  revokeOthers(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.sessions.revokeOthers(auth.privyUserId, auth.sessionId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.sessions.revoke(auth.privyUserId, id);
  }
}
