import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { InvestigationsService } from "./investigations.service";

@Controller("access")
@UseGuards(PrivyAuthGuard)
export class AccessController {
  constructor(private readonly investigations: InvestigationsService) {}
  @Get() getAccess(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.investigations.access(auth.privyUserId);
  }
}
