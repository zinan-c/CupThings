import type { FastifyInstance } from "fastify";
import { createProfileSchema } from "@cupthings/shared";
import { db } from "../db/client.js";
import { profiles } from "../db/schema.js";
import { createAnonymousToken, hashToken, requireProfile } from "../auth.js";
import { parseInput, sendError } from "../http.js";
import { toProfile } from "../mappers.js";

export async function registerProfileRoutes(app: FastifyInstance) {
  app.post("/profiles", async (request, reply) => {
    try {
      const input = parseInput(createProfileSchema, request.body);
      const token = createAnonymousToken();
      const [profile] = await db
        .insert(profiles)
        .values({
          displayName: input.displayName,
          tokenHash: hashToken(token)
        })
        .returning();

      if (!profile) {
        throw new Error("Profile was not created");
      }

      return reply.status(201).send({ profile: toProfile(profile), token });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/me", { preHandler: requireProfile }, async (request) => ({
    profile: toProfile(request.profile)
  }));
}
