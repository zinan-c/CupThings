import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db/client.js";
import { profiles, sessions } from "./db/schema.js";
import { HttpError } from "./http.js";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCESS_COOKIE_NAME = "cupthings.access";
export const REFRESH_COOKIE_NAME = "cupthings.refresh";

export function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000)
  };
}

export function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function createRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getAccessTokenFromRequest(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }
  return request.cookies?.[ACCESS_COOKIE_NAME];
}

export function getRefreshTokenFromRequest(request: FastifyRequest, bodyToken?: string) {
  return bodyToken ?? request.cookies?.[REFRESH_COOKIE_NAME];
}

export async function getAuthContextFromRequest(request: FastifyRequest) {
  const token = getAccessTokenFromRequest(request);

  if (!token) {
    throw new HttpError(401, "Missing token");
  }

  const now = new Date();
  const [result] = await db
    .select({ profile: profiles, session: sessions })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.profileId, profiles.id))
    .where(and(
      eq(sessions.accessTokenHash, hashToken(token)),
      gt(sessions.accessExpiresAt, now),
      isNull(sessions.revokedAt)
    ))
    .limit(1);

  if (!result) {
    throw new HttpError(401, "Invalid token");
  }

  await db.update(sessions)
    .set({ lastUsedAt: now })
    .where(eq(sessions.id, result.session.id));

  return result;
}

export async function requireProfile(request: FastifyRequest, _reply: FastifyReply) {
  const result = await getAuthContextFromRequest(request);
  request.profile = result.profile;
  request.session = result.session;
}
