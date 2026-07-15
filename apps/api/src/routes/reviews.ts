import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { cupThingCategories, reviewQuerySchema, type ReviewStats } from "@cupthings/shared";
import { requireProfile } from "../auth.js";
import { db } from "../db/client.js";
import { cupThings } from "../db/schema.js";
import { parseInput, sendError } from "../http.js";
import { toCupThing } from "../mappers.js";

export async function registerReviewRoutes(app: FastifyInstance) {
  app.get("/reviews", { preHandler: requireProfile }, async (request, reply) => {
    try {
      const query = parseInput(reviewQuerySchema, request.query);
      const rows = await db
        .select()
        .from(cupThings)
        .where(
          and(
            eq(cupThings.profileId, request.profile.id),
            query.category ? eq(cupThings.category, query.category) : undefined,
            gte(cupThings.consumedAt, new Date(query.from)),
            lte(cupThings.consumedAt, new Date(query.to))
          )
        )
        .orderBy(desc(cupThings.consumedAt));

      const ratedRows = rows.filter((row) => row.ratingHalfSteps != null);
      const stats: ReviewStats = {
        totalCount: rows.length,
        countByCategory: Object.fromEntries(
          cupThingCategories.map((category) => [
            category,
            rows.filter((row) => row.category === category).length
          ])
        ) as ReviewStats["countByCategory"],
        averageRating: ratedRows.length
          ? ratedRows.reduce((sum, row) => sum + Number(row.ratingHalfSteps), 0) / ratedRows.length / 2
          : null
      };

      return { records: rows.map(toCupThing), stats };
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
