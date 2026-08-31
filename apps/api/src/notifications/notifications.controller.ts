import { Controller, Delete, Get, HttpCode, Param, Patch, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(PrivyAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("unread-count")
  unreadCount(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.notifications.unreadCount(auth.privyUserId);
  }

  @Get()
  list(@CurrentAuth() auth: AuthenticatedIdentity, @Query() query: ListNotificationsDto) {
    return this.notifications.list(auth.privyUserId, query);
  }

  @Patch("read-all")
  readAll(@CurrentAuth() auth: AuthenticatedIdentity) {
    return this.notifications.markAllRead(auth.privyUserId);
  }

  @Patch(":id/read")
  read(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.notifications.markRead(auth.privyUserId, id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentAuth() auth: AuthenticatedIdentity, @Param("id") id: string) {
    return this.notifications.remove(auth.privyUserId, id);
  }
}
