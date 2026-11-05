import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { apiEnvironmentFiles } from "./config/environment";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { InvestigationsModule } from "./investigations/investigations.module";
import { PaymentsModule } from "./payments/payments.module";
import { UsersModule } from "./users/users.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: apiEnvironmentFiles(__dirname, process.env.NODE_ENV) }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    InvestigationsModule,
    PaymentsModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
