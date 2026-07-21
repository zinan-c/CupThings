import type { FastifyInstance, FastifyReply } from "fastify";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  refreshTokenSchema,
  requestLoginSchema,
  verifyLoginSchema
} from "@cupthings/shared";
import { db } from "../db/client.js";
import { accounts, cupThings, loginChallenges, profiles, sessions } from "../db/schema.js";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
  createAccessToken,
  createRefreshToken,
  getAuthContextFromRequest,
  getRefreshTokenFromRequest,
  hashToken,
  requireProfile,
  sessionCookieOptions
} from "../auth.js";
import { sendLoginLink } from "../email.js";
import { parseInput, HttpError, sendError } from "../http.js";
import { toProfile } from "../mappers.js";

const LOGIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/request-link", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const input = parseInput(requestLoginSchema, request.body);
      let profileId: string | undefined;

      try {
        profileId = (await getAuthContextFromRequest(request)).profile.id;
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode !== 401) throw error;
      }

      const token = createAccessToken();
      await db.delete(loginChallenges).where(and(
        eq(loginChallenges.email, input.email),
        isNull(loginChallenges.usedAt)
      ));
      await db.insert(loginChallenges).values({
        email: input.email,
        displayName: input.displayName,
        tokenHash: hashToken(token),
        profileId,
        expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS)
      });

      await sendLoginLink(input.email, token);
      return reply.status(202).send({ message: "If the address can be used, a sign-in link has been sent." });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/auth/verify", async (request, reply) => {
    try {
      const input = parseInput(verifyLoginSchema, request.body);
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        const [challenge] = await tx
          .select()
          .from(loginChallenges)
          .where(and(
            eq(loginChallenges.tokenHash, hashToken(input.token)),
            isNull(loginChallenges.usedAt),
            gt(loginChallenges.expiresAt, now)
          ))
          .limit(1);

        if (!challenge) throw new HttpError(401, "Invalid or expired login link");

        const [accountBefore] = await tx
          .select()
          .from(accounts)
          .where(eq(accounts.email, challenge.email))
          .limit(1);
        const account = accountBefore ?? (await tx.insert(accounts).values({ email: challenge.email }).returning())[0];
        if (!account) throw new Error("Account was not created");

        const [sourceProfile] = challenge.profileId
          ? await tx.select().from(profiles).where(eq(profiles.id, challenge.profileId)).limit(1)
          : [];
        const [accountProfile] = await tx
          .select()
          .from(profiles)
          .where(eq(profiles.accountId, account.id))
          .limit(1);

        let profile = accountProfile;
        if (sourceProfile && accountProfile && sourceProfile.id !== accountProfile.id) {
          await tx.update(cupThings)
            .set({ profileId: accountProfile.id })
            .where(eq(cupThings.profileId, sourceProfile.id));
          await tx.delete(profiles).where(eq(profiles.id, sourceProfile.id));
        } else if (sourceProfile) {
          const [updatedProfile] = await tx
            .update(profiles)
            .set({ accountId: account.id, updatedAt: now })
            .where(eq(profiles.id, sourceProfile.id))
            .returning();
          profile = updatedProfile;
        }

        if (!profile) {
          const fallbackName = challenge.displayName ?? challenge.email.split("@")[0] ?? "CupThings user";
          const [createdProfile] = await tx
            .insert(profiles)
            .values({ accountId: account.id, displayName: fallbackName.slice(0, 80) })
            .returning();
          profile = createdProfile;
        }

        if (!profile) throw new Error("Profile was not created");

        await tx.update(loginChallenges)
          .set({ usedAt: now })
          .where(eq(loginChallenges.id, challenge.id));
        await tx.update(sessions)
          .set({ revokedAt: now })
          .where(and(eq(sessions.profileId, profile.id), isNull(sessions.revokedAt)));

        const accessToken = createAccessToken();
        const refreshToken = createRefreshToken();
        await tx.insert(sessions).values({
          profileId: profile.id,
          accessTokenHash: hashToken(accessToken),
          refreshTokenHash: hashToken(refreshToken),
          accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS)
        });

        return { profile, accessToken, refreshToken };
      });

      setSessionCookies(reply, result.accessToken, result.refreshToken);
      return reply.send({
        profile: toProfile(result.profile),
        token: result.accessToken,
        refreshToken: result.refreshToken
      });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/auth/refresh", async (request, reply) => {
    try {
      const input = parseInput(refreshTokenSchema, request.body ?? {});
      const refreshToken = getRefreshTokenFromRequest(request, input.refreshToken);
      if (!refreshToken) throw new HttpError(401, "Missing refresh token");

      const now = new Date();
      const [result] = await db
        .select({ profile: profiles, session: sessions })
        .from(sessions)
        .innerJoin(profiles, eq(sessions.profileId, profiles.id))
        .where(and(
          eq(sessions.refreshTokenHash, hashToken(refreshToken)),
          gt(sessions.refreshExpiresAt, now),
          isNull(sessions.revokedAt)
        ))
        .limit(1);
      if (!result) throw new HttpError(401, "Invalid or expired refresh token");

      const accessToken = createAccessToken();
      const nextRefreshToken = createRefreshToken();
      await db.update(sessions)
        .set({
          accessTokenHash: hashToken(accessToken),
          refreshTokenHash: hashToken(nextRefreshToken),
          accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
          lastUsedAt: now
        })
        .where(and(eq(sessions.id, result.session.id), isNull(sessions.revokedAt)));

      setSessionCookies(reply, accessToken, nextRefreshToken);
      return reply.send({
        profile: toProfile(result.profile),
        token: accessToken,
        refreshToken: nextRefreshToken
      });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/auth/logout", { preHandler: requireProfile }, async (request, reply) => {
    await db.update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, request.session.id));
    clearSessionCookies(reply);
    return reply.status(204).send();
  });
}

function setSessionCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  reply.setCookie(ACCESS_COOKIE_NAME, accessToken, sessionCookieOptions(ACCESS_TOKEN_TTL_MS));
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, sessionCookieOptions(REFRESH_TOKEN_TTL_MS));
}

function clearSessionCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
}
