import { Controller, Delete, UseGuards } from "@nestjs/common";
import type { AuthenticatedIdentity } from "../auth/auth.types";
import { CurrentAuth } from "../auth/current-auth.decorator";
import { PrivyAuthGuard } from "../auth/privy-auth.guard";
import { NotificationsService } from "../notifications/notifications.service";
import { InvestigationsService } from "./investigations.service";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { ApiErrorResponseDto, DeleteHistoryResponseDto } from "../openapi/openapi.models";

@Controller("me/investigations")
@UseGuards(PrivyAuthGuard)
@ApiTags("Investigations")
@ApiBearerAuth("privy")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class HistoryController {
  constructor(
    private readonly investigations: InvestigationsService,
    private readonly notifications: NotificationsService,
  ) {}
  @Delete()
  @ApiOperation({
    summary: "Delete all investigation history",
    description:
      "Permanently deletes every investigation owned by the authenticated user and soft-deletes the related activity notifications.",
  })
  @ApiOkResponse({ type: DeleteHistoryResponseDto })
  async deleteHistory(@CurrentAuth() auth: AuthenticatedIdentity) {
    const investigations = await this.investigations.deleteHistory(auth.privyUserId);
    const notifications = await this.notifications.deleteInvestigationNotifications(auth.privyUserId);
    return {
      ...investigations,
      notificationsDeletedCount: notifications.deletedCount,
    };
  }
}
