import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PrivyAuthGuard } from "./privy-auth.guard";
import { PrivyAuthService } from "./privy-auth.service";
import { PrivySessionsService } from "./privy-sessions.service";
import { PrivySession, PrivySessionSchema } from "./schemas/privy-session.schema";
import { SessionsController } from "./sessions.controller";

@Module({
  imports: [MongooseModule.forFeature([{ name: PrivySession.name, schema: PrivySessionSchema }])],
  controllers: [SessionsController],
  providers: [PrivyAuthService, PrivySessionsService, PrivyAuthGuard],
  exports: [PrivyAuthService, PrivySessionsService, PrivyAuthGuard, MongooseModule],
})
export class AuthModule {}
