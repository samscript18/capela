import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedIdentity } from "./auth.types";
import { PrivySession, type PrivySessionDocument } from "./schemas/privy-session.schema";

const MAX_SESSION_ID_LENGTH = 256;
const MAX_USER_AGENT_LENGTH = 512;

export type SessionClientContext = {
  userAgent?: string;
};

export type AccountSession = {
  id: string;
  current: boolean;
  deviceName: string;
  platform: string;
  browser: string;
  userAgentSummary?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
};

@Injectable()
export class PrivySessionsService {
  constructor(@InjectModel(PrivySession.name) private readonly sessions: Model<PrivySessionDocument>) {}

  async assertActiveAndTouch(identity: AuthenticatedIdentity, context: SessionClientContext) {
    const now = new Date();
    const userAgentSummary = normalizeUserAgent(context.userAgent);
    const client = parseUserAgent(userAgentSummary);
    const metadata = userAgentSummary
      ? {
          userAgentSummary,
          deviceName: client.deviceName,
          platform: client.platform,
          browser: client.browser,
        }
      : {};

    const session = await this.sessions
      .findOneAndUpdate(
        { privyUserId: identity.privyUserId, sessionId: identity.sessionId },
        {
          $set: { ...metadata, lastUsedAt: now },
          $max: { tokenIssuedAt: identity.issuedAt, expiresAt: identity.expiresAt },
          $setOnInsert: {
            privyUserId: identity.privyUserId,
            sessionId: identity.sessionId,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      )
      .lean()
      .orFail()
      .exec();

    if (session.revokedAt) throw new UnauthorizedException("This Privy session has been revoked");
  }

  async list(privyUserId: string, currentSessionId: string): Promise<AccountSession[]> {
    const sessions = await this.sessions
      .find({ privyUserId, revokedAt: { $exists: false } })
      .sort({ lastUsedAt: -1 })
      .lean()
      .exec();

    return sessions.map((session) => ({
      id: session.sessionId,
      current: session.sessionId === currentSessionId,
      deviceName: session.deviceName ?? "Unknown device",
      platform: session.platform ?? "Unknown platform",
      browser: session.browser ?? "Unknown browser",
      ...(session.userAgentSummary ? { userAgentSummary: session.userAgentSummary } : {}),
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    }));
  }

  async revoke(privyUserId: string, sessionId: string) {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId || normalizedSessionId.length > MAX_SESSION_ID_LENGTH) {
      throw new BadRequestException("Invalid session ID");
    }

    const result = await this.sessions
      .updateOne(
        { privyUserId, sessionId: normalizedSessionId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokedReason: "USER_REVOKED" } },
      )
      .exec();

    if (result.matchedCount === 0) throw new NotFoundException("Active session not found");
  }

  async revokeOthers(privyUserId: string, currentSessionId: string) {
    const result = await this.sessions
      .updateMany(
        {
          privyUserId,
          sessionId: { $ne: currentSessionId },
          revokedAt: { $exists: false },
        },
        { $set: { revokedAt: new Date(), revokedReason: "USER_REVOKED_OTHER_SESSIONS" } },
      )
      .exec();
    return { revokedCount: result.modifiedCount };
  }
}

export function parseUserAgent(value?: string) {
  const userAgent = value ?? "";
  const browser = browserName(userAgent);
  const platform = platformName(userAgent);
  return { browser, platform, deviceName: deviceName(userAgent, platform) };
}

function normalizeUserAgent(value?: string) {
  const printable = value
    ?.split("")
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("");
  const normalized = printable?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, MAX_USER_AGENT_LENGTH) : undefined;
}

function browserName(userAgent: string) {
  if (/Edg(?:A|iOS)?\//i.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/SamsungBrowser\//i.test(userAgent)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//i.test(userAgent)) return "Firefox";
  if (/CriOS\/|Chrome\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Unknown browser";
}

function platformName(userAgent: string) {
  if (/Windows NT/i.test(userAgent)) return "Windows";
  if (/CrOS/i.test(userAgent)) return "Chrome OS";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown platform";
}

function deviceName(userAgent: string, platform: string) {
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/iPhone|iPod/i.test(userAgent)) return "iPhone";
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) return "Android phone";
  if (/Android/i.test(userAgent)) return "Android tablet";
  if (platform === "macOS") return "Mac";
  if (platform === "Windows") return "Windows PC";
  if (platform === "Chrome OS") return "Chromebook";
  if (platform === "Linux") return "Linux computer";
  return "Unknown device";
}
