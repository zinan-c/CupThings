import type { FastifyInstance, FastifyReply } from "fastify";
import { requestLoginSchema, refreshTokenSchema, verifyLoginSchema } from "@cupthings/shared";
import { getAuthContextFromRequest, getRefreshTokenFromRequest, requireProfile, sessionCookieOptions, ACCESS_COOKIE_NAME, ACCESS_TOKEN_TTL_MS, REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_MS } from "../auth.js";
import { parseInput, HttpError, sendError } from "../http.js";
import { sendLoginLink } from "../email.js";
import { toProfile } from "../mappers.js";
import { createLoginChallenge, deleteAccount, revokeSession, rotateRefreshToken, verifyLoginChallenge } from "../services/auth-service.js";

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
      const token = await createLoginChallenge(input.email, input.displayName, profileId);
      await sendLoginLink(input.email, token);
      return reply.status(202).send({ message: "If the address can be used, a sign-in link has been sent." });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post("/auth/verify", async (request, reply) => {
    try {
      const input = parseInput(verifyLoginSchema, request.body);
      const result = await verifyLoginChallenge(input.token);
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
      const result = await rotateRefreshToken(refreshToken);
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

  app.post("/auth/logout", { preHandler: requireProfile }, async (request, reply) => {
    await revokeSession(request.session.id);
    clearSessionCookies(reply);
    return reply.status(204).send();
  });

  app.delete("/account", { preHandler: requireProfile }, async (request, reply) => {
    await deleteAccount(request.profile.id, request.profile.accountId);
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
