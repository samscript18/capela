import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { CreateInvestigationDto } from "./dto/create-investigation.dto";
import { ListInvestigationsDto } from "./dto/list-investigations.dto";
import { InvestigationsService } from "./investigations.service";

@Controller("investigations")
@UseGuards(PrivyAuthGuard)
export class InvestigationsController {
  constructor(private readonly investigations: InvestigationsService) {}
  @Post() create(@CurrentAuth() auth: AuthenticatedIdentity, @Body() input: CreateInvestigationDto) {
    return this.investigations.create(auth.privyUserId, input);
  }
  @Get() list(@CurrentAuth() auth: AuthenticatedIdentity, @Query() query: ListInvestigationsDto) {
    return this.investigations.list(auth.privyUserId, query);
  }
  @Get(":id") get(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.investigations.get(auth.privyUserId, id);
  }
  @Post(":id/retry") retry(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.investigations.retry(auth.privyUserId, id);
  }
}
