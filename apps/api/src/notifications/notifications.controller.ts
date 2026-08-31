import { Controller, Delete, Get, HttpCode, Param, Patch, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import { NotificationsService } from "./notifications.service";
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
import {
  ApiErrorResponseDto,
  NotificationListResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
  UpdatedCountResponseDto,
} from "../openapi/openapi.models";

@Controller("notifications")
@UseGuards(PrivyAuthGuard)
@ApiTags("Notifications")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("unread-count")
  @ApiOperation({
    summary: "Get unread notification count",
    description: "Synchronizes notifications from terminal investigation activity before counting unread items.",
  })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  unreadCount(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.notifications.unreadCount(auth.privyUserId);
  }

  @Get()
  @ApiOperation({
    summary: "List notifications",
    description:
      "Returns cursor-paginated, newest-first notifications derived from completed and failed investigations. No fake notifications are seeded.",
  })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Invalid cursor or limit." })
  list(@CurrentAuth() auth: AuthenticatedIdentity, @Query() query: ListNotificationsDto) {
    return this.notifications.list(auth.privyUserId, query);
  }

  @Patch("read-all")
  @ApiOperation({ summary: "Mark every notification as read" })
  @ApiOkResponse({ type: UpdatedCountResponseDto })
  readAll(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.notifications.markAllRead(auth.privyUserId);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one notification as read" })
  @ApiParam({ name: "id", description: "MongoDB notification ID", example: "66d2e2b59d8f09f1c2a7b431" })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Invalid notification ID." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: "Notification not found for this user." })
  read(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.notifications.markRead(auth.privyUserId, id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({
    summary: "Delete one notification",
    description: "Soft-deletes an owner-scoped notification so it no longer appears in the notification feed.",
  })
  @ApiParam({ name: "id", description: "MongoDB notification ID", example: "66d2e2b59d8f09f1c2a7b431" })
  @ApiNoContentResponse({ description: "Notification deleted." })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto, description: "Invalid notification ID." })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto, description: "Notification not found for this user." })
  remove(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.notifications.remove(auth.privyUserId, id);
  }
}
