import type { profiles } from "../db/schema.js";

declare module "fastify" {
  interface FastifyRequest {
    profile: typeof profiles.$inferSelect;
  }
}
