import type { Request } from "express";

export type AuthenticatedIdentity = {
  privyUserId: string;
  sessionId: string;
  issuedAt: Date;
  expiresAt: Date;
};
export type AuthenticatedRequest = Request & { auth: AuthenticatedIdentity };
