import type { FastifyInstance } from "fastify";
import { createProfileSchema } from "@cupthings/shared";
import { db } from "../db/client.js";
import { profiles, sessions } from "../db/schema.js";
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS, createAccessToken, createRefreshToken, hashToken, requireProfile } from "../auth.js";
import { parseInput, sendError } from "../http.js";
import { toProfile } from "../mappers.js";

export async function registerProfileRoutes(app: FastifyInstance) {
  app.post("/profiles", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const input = parseInput(createProfileSchema, request.body);
      const accessToken = createAccessToken();
      const refreshToken = createRefreshToken();
      const now = new Date();
      const [profile] = await db.transaction(async (tx) => {
        const [createdProfile] = await tx
          .insert(profiles)
          .values({ displayName: input.displayName })
          .returning();

        if (!createdProfile) {
          throw new Error("Profile was not created");
        }

        await tx.insert(sessions).values({
          profileId: createdProfile.id,
          accessTokenHash: hashToken(accessToken),
          refreshTokenHash: hashToken(refreshToken),
          accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS)
        })
        return [createdProfile];
      });

      if (!profile) {
        throw new Error("Profile was not created");
      }

      return reply.status(201).send({ profile: toProfile(profile), token: accessToken, refreshToken });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/me", { preHandler: requireProfile }, async (request) => ({
    profile: toProfile(request.profile)
  }));
}
