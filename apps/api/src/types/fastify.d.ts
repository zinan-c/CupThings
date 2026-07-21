import type { profiles, sessions } from "../db/schema.js";

declare module "fastify" {
  interface FastifyRequest {
    profile: typeof profiles.$inferSelect;
    session: typeof sessions.$inferSelect;
  }
}
