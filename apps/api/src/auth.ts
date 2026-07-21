import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db/client.js";
import { profiles, sessions } from "./db/schema.js";
import { HttpError } from "./http.js";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function createRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getProfileFromRequest(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

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

  return result.profile;
}

export async function requireProfile(request: FastifyRequest, _reply: FastifyReply) {
  request.profile = await getProfileFromRequest(request);
}
