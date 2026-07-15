import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { profiles } from "./db/schema.js";
import { HttpError } from "./http.js";

export function createAnonymousToken() {
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

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.tokenHash, hashToken(token)))
    .limit(1);

  if (!profile) {
    throw new HttpError(401, "Invalid token");
  }

  return profile;
}

export async function requireProfile(request: FastifyRequest, _reply: FastifyReply) {
  request.profile = await getProfileFromRequest(request);
}
