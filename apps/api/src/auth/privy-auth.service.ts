import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrivyClient } from "@privy-io/node";
import type { AuthenticatedIdentity } from "./auth.types";

@Injectable()
export class PrivyAuthService {
  private readonly logger = new Logger(PrivyAuthService.name);
  private readonly client?: PrivyClient;

  constructor(config: ConfigService) {
    const appId = config.get<string>("PRIVY_APP_ID");
    const appSecret = config.get<string>("PRIVY_APP_SECRET");
    const configuredVerificationKey = config.get<string>("PRIVY_JWT_VERIFICATION_KEY");
    const verificationKey = normalizePrivyVerificationKey(configuredVerificationKey);
    if (configuredVerificationKey?.trim() && !verificationKey) {
      this.logger.warn("PRIVY_JWT_VERIFICATION_KEY is not a valid SPKI public key; using Privy's JWKS instead");
    }
    if (appId && appSecret) {
      this.client = new PrivyClient({ appId, appSecret, jwtVerificationKey: verificationKey });
    }
  }

  async verify(token: string): Promise<AuthenticatedIdentity> {
    if (!this.client) throw new ServiceUnavailableException("Privy server authentication is not configured");
    try {
      const claims = await this.client.utils().auth().verifyAccessToken(token);
      return {
        privyUserId: claims.user_id,
        sessionId: claims.session_id,
        issuedAt: new Date(claims.issued_at * 1_000),
        expiresAt: new Date(claims.expiration * 1_000),
      };
    } catch (error) {
      this.logger.warn(
        `Privy access token verification failed: ${error instanceof Error ? error.message : "unknown verification error"}`,
      );
      throw new UnauthorizedException("Invalid or expired Privy access token");
    }
  }

  async getUserProfile(privyUserId: string) {
    if (!this.client) return undefined;
    try {
      const user = await this.client.users()._get(privyUserId);
      const emailAccount = user.linked_accounts.find(
        (account) => account.type === "email" || account.type === "google_oauth" || account.type === "apple_oauth",
      );
      const walletAccount = user.linked_accounts.find(
        (account) => account.type === "wallet" && "chain_type" in account && account.chain_type === "ethereum",
      );
      const avatarAccount = user.linked_accounts.find(
        (account) => "profile_picture_url" in account && Boolean(account.profile_picture_url),
      );
      const nameAccount = user.linked_accounts.find((account) => "name" in account && Boolean(account.name));
      return {
        email:
          emailAccount && "address" in emailAccount
            ? emailAccount.address
            : emailAccount && "email" in emailAccount
              ? (emailAccount.email ?? undefined)
              : undefined,
        displayName: nameAccount && "name" in nameAccount ? (nameAccount.name ?? undefined) : undefined,
        avatarUrl:
          avatarAccount && "profile_picture_url" in avatarAccount
            ? (avatarAccount.profile_picture_url ?? undefined)
            : undefined,
        primaryWalletAddress: walletAccount && "address" in walletAccount ? walletAccount.address : undefined,
      };
    } catch {
      this.logger.warn("Privy profile metadata could not be synchronized");
      return undefined;
    }
  }

  async getEthereumWalletAddresses(privyUserId: string) {
    if (!this.client) throw new ServiceUnavailableException("Privy server authentication is not configured");
    try {
      const user = await this.client.users()._get(privyUserId);
      return user.linked_accounts
        .filter(
          (account) =>
            account.type === "wallet" &&
            "chain_type" in account &&
            account.chain_type === "ethereum" &&
            "address" in account,
        )
        .map((account) => (account as { address: string }).address.toLowerCase());
    } catch {
      throw new ServiceUnavailableException("Privy wallet ownership could not be confirmed");
    }
  }

  async deleteUser(privyUserId: string) {
    if (!this.client) throw new ServiceUnavailableException("Privy server authentication is not configured");
    try {
      await this.client.users().delete(privyUserId);
    } catch (error) {
      if (privyErrorStatus(error) === 404) return;
      this.logger.warn(`Privy user deletion failed (${privyErrorStatus(error) ?? "unknown provider error"})`);
      throw new ServiceUnavailableException("Privy account deletion is temporarily unavailable");
    }
  }
}

export function normalizePrivyVerificationKey(value?: string) {
  const normalized = value?.trim().replaceAll("\\n", "\n");
  if (!normalized) return undefined;
  if (!/^-----BEGIN PUBLIC KEY-----\r?\n[\s\S]+\r?\n-----END PUBLIC KEY-----$/.test(normalized)) return undefined;
  return normalized;
}

function privyErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}
