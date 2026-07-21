import type { FastifyInstance } from "fastify";
import { reviewQuerySchema } from "@cupthings/shared";
import { requireProfile } from "../auth.js";
import { parseInput, sendError } from "../http.js";
import { getReview } from "../services/review-service.js";

export async function registerReviewRoutes(app: FastifyInstance) {
  app.get("/reviews", { preHandler: requireProfile }, async (request, reply) => {
    try {
      const query = parseInput(reviewQuerySchema, request.query);
      return getReview(request.profile.id, query.from, query.to, query.category);
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
