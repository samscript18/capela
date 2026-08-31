import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.types";
import { PrivyAuthService } from "./privy-auth.service";
import { PrivySessionsService } from "./privy-sessions.service";

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(
    private readonly auth: PrivyAuthService,
    private readonly sessions: PrivySessionsService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) throw new UnauthorizedException("Missing Privy access token");
    const identity = await this.auth.verify(token);
    await this.sessions.assertActiveAndTouch(identity, { userAgent: request.headers["user-agent"] });
    request.auth = identity;
    return true;
  }
}
