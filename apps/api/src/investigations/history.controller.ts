import { Controller, Delete, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { NotificationsService } from "../notifications/notifications.service";
import { InvestigationsService } from "./investigations.service";

@Controller("me/investigations")
@UseGuards(PrivyAuthGuard)
export class HistoryController {
  constructor(
    private readonly investigations: InvestigationsService,
    private readonly notifications: NotificationsService,
  ) {}
  @Delete() async deleteHistory(@CurrentAuth() auth: AuthenticatedIdentity) {
    const investigations = await this.investigations.deleteHistory(auth.privyUserId);
    const notifications = await this.notifications.deleteInvestigationNotifications(auth.privyUserId);
    return {
      ...investigations,
      notificationsDeletedCount: notifications.deletedCount,
    };
  }
}
