import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { CreateInvestigationDto } from "./dto/create-investigation.dto";
import { ListInvestigationsDto } from "./dto/list-investigations.dto";
import { InvestigationsService } from "./investigations.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  ApiErrorResponseDto,
  DeleteInvestigationResponseDto,
  InvestigationResponseDto,
} from "../openapi/openapi.models";

@Controller("investigations")
@UseGuards(PrivyAuthGuard)
@ApiTags("Investigations")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({
  type: ApiErrorResponseDto,
  description: "Missing, invalid, expired, or revoked Privy access token.",
})
export class InvestigationsController {
  constructor(
    private readonly investigations: InvestigationsService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Start a molecule investigation",
    description:
      "Creates a queued asynchronous investigation after checking preview/free/payment access. Poll the returned investigation resource for progress and the final dossier.",
  })
  @ApiCreatedResponse({
    type: InvestigationResponseDto,
    description: "Investigation accepted and queued, or a reusable completed investigation returned.",
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Input or payment ID validation failed." })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: "Another free investigation is active or the selected entitlement cannot be consumed.",
  })
  @ApiResponse({
    status: 402,
    type: ApiErrorResponseDto,
    description: "Free access is exhausted and a verified Base payment is required.",
  })
  create(@CurrentAuth() auth: AuthenticatedIdentity, @Body() input: CreateInvestigationDto) {
    return this.investigations.create(auth.privyUserId, input);
  }
  @Get()
  @ApiOperation({
    summary: "List investigation history",
    description: "Returns up to 100 owner-scoped investigations, newest first, optionally filtered by status.",
  })
  @ApiOkResponse({ type: [InvestigationResponseDto] })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Unknown status filter." })
  list(@CurrentAuth() auth: AuthenticatedIdentity, @Query() query: ListInvestigationsDto) {
    return this.investigations.list(auth.privyUserId, query);
  }
  @Get(":id")
  @ApiOperation({
    summary: "Get an investigation",
    description:
      "Returns current progress, terminal error, or the completed evidence dossier for an owner-scoped investigation.",
  })
  @ApiParam({ name: "id", description: "MongoDB investigation ID", example: "66d2e2b59d8f09f1c2a7b431" })
  @ApiOkResponse({ type: InvestigationResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Invalid investigation ID." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: "Investigation not found for this user." })
  get(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.investigations.get(auth.privyUserId, id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete an investigation",
    description:
      "Permanently deletes one owner-scoped investigation and removes its related activity notifications. An unfinished paid entitlement is released.",
  })
  @ApiParam({ name: "id", description: "MongoDB investigation ID", example: "66d2e2b59d8f09f1c2a7b431" })
  @ApiOkResponse({ type: DeleteInvestigationResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Invalid investigation ID." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: "Investigation not found for this user." })
  async remove(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    const investigation = await this.investigations.remove(auth.privyUserId, id);
    const notifications = await this.notifications.deleteForInvestigation(auth.privyUserId, id);
    return { ...investigation, notificationsDeletedCount: notifications.deletedCount };
  }

  @Post(":id/retry")
  @ApiOperation({
    summary: "Retry a failed investigation",
    description:
      "Resets and requeues an owner-scoped failed run. A provider or pipeline failure does not consume another successful free-investigation allowance.",
  })
  @ApiParam({ name: "id", description: "MongoDB investigation ID", example: "66d2e2b59d8f09f1c2a7b431" })
  @ApiCreatedResponse({ type: InvestigationResponseDto, description: "Failed investigation reset and queued again." })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Invalid investigation ID." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: "Investigation not found for this user." })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: "The run is not failed, another free run is active, or a concurrent retry won the race.",
  })
  retry(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.investigations.retry(auth.privyUserId, id);
  }
}
