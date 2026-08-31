import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { ResearchModule } from "../research/research.module";
import { PaymentsModule } from "../payments/payments.module";
import { AccessController } from "./access.controller";
import { InvestigationsController } from "./investigations.controller";
import { HistoryController } from "./history.controller";
import { InvestigationsService } from "./investigations.service";
import { Investigation, InvestigationSchema } from "./schemas/investigation.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Investigation.name, schema: InvestigationSchema }]),
    AuthModule,
    UsersModule,
    NotificationsModule,
    ResearchModule,
    PaymentsModule,
  ],
  controllers: [InvestigationsController, AccessController, HistoryController],
  providers: [InvestigationsService],
  exports: [InvestigationsService, MongooseModule],
})
export class InvestigationsModule {}
