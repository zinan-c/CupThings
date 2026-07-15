import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  createCupThingSchema,
  cupThingListQuerySchema,
  updateCupThingSchema,
  uuidParamSchema
} from "@cupthings/shared";
import { requireProfile } from "../auth.js";
import { db } from "../db/client.js";
import { cupThings } from "../db/schema.js";
import { HttpError, parseInput, sendError } from "../http.js";
import { toCupThing, toRatingHalfSteps } from "../mappers.js";

export async function registerCupThingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireProfile);

  app.post("/cup-things", async (request, reply) => {
    try {
      const input = parseInput(createCupThingSchema, request.body);
      const [cupThing] = await db
        .insert(cupThings)
        .values({
          profileId: request.profile.id,
          name: input.name,
          category: input.category,
          consumedAt: new Date(input.consumedAt),
          location: input.location,
          style: input.style,
          flavors: input.flavors,
          ratingHalfSteps: toRatingHalfSteps(input.rating),
          notes: input.notes
        })
        .returning();

      if (!cupThing) {
        throw new Error("CupThing was not created");
      }

      return reply.status(201).send({ cupThing: toCupThing(cupThing) });
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/cup-things", async (request, reply) => {
    try {
      const query = parseInput(cupThingListQuerySchema, request.query);
      const filters = [
        eq(cupThings.profileId, request.profile.id),
        query.category ? eq(cupThings.category, query.category) : undefined,
        query.from ? gte(cupThings.consumedAt, new Date(query.from)) : undefined,
        query.to ? lte(cupThings.consumedAt, new Date(query.to)) : undefined
      ].filter(Boolean);

      const rows = await db
        .select()
        .from(cupThings)
        .where(and(...filters))
        .orderBy(desc(cupThings.consumedAt));

      return { cupThings: rows.map(toCupThing) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get("/cup-things/:id", async (request, reply) => {
    try {
      const { id } = parseInput(uuidParamSchema, request.params);
      const row = await findCupThing(request.profile.id, id);
      return { cupThing: toCupThing(row) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.patch("/cup-things/:id", async (request, reply) => {
    try {
      const { id } = parseInput(uuidParamSchema, request.params);
      await findCupThing(request.profile.id, id);
      const input = parseInput(updateCupThingSchema, request.body);
      const [updated] = await db
        .update(cupThings)
        .set({
          ...("name" in input ? { name: input.name } : {}),
          ...("category" in input ? { category: input.category } : {}),
          ...(input.consumedAt !== undefined ? { consumedAt: new Date(input.consumedAt) } : {}),
          ...("location" in input ? { location: input.location ?? null } : {}),
          ...("style" in input ? { style: input.style ?? null } : {}),
          ...("flavors" in input ? { flavors: input.flavors ?? [] } : {}),
          ...("rating" in input ? { ratingHalfSteps: toRatingHalfSteps(input.rating) } : {}),
          ...("notes" in input ? { notes: input.notes ?? null } : {}),
          updatedAt: new Date()
        })
        .where(and(eq(cupThings.id, id), eq(cupThings.profileId, request.profile.id)))
        .returning();

      if (!updated) {
        throw new Error("CupThing was not updated");
      }

      return { cupThing: toCupThing(updated) };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete("/cup-things/:id", async (request, reply) => {
    try {
      const { id } = parseInput(uuidParamSchema, request.params);
      await findCupThing(request.profile.id, id);
      await db.delete(cupThings).where(and(eq(cupThings.id, id), eq(cupThings.profileId, request.profile.id)));
      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });
}

async function findCupThing(profileId: string, id: string) {
  const [row] = await db
    .select()
    .from(cupThings)
    .where(and(eq(cupThings.id, id), eq(cupThings.profileId, profileId)))
    .limit(1);

  if (!row) {
    throw new HttpError(404, "CupThing not found");
  }

  return row;
}
