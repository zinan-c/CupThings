import cors from "@fastify/cors";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { registerCupThingRoutes } from "./routes/cup-things.js";
import { registerProfileRoutes } from "./routes/profiles.js";
import { registerReviewRoutes } from "./routes/reviews.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  const configuredOrigins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, { origin: configuredOrigins });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });

  await app.register(registerProfileRoutes);
  await app.register(registerCupThingRoutes);
  await app.register(registerReviewRoutes);

  return app;
}
