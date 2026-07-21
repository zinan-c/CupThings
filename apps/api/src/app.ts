import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { registerCupThingRoutes } from "./routes/cup-things.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProfileRoutes } from "./routes/profiles.js";
import { registerReviewRoutes } from "./routes/reviews.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 32 * 1024,
    trustProxy: process.env.TRUST_PROXY === "true"
  });

  const configuredOrigins = (process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, { origin: configuredOrigins });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    max: 5,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Too many profile creation attempts. Try again later."
    })
  });

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
  await app.register(registerAuthRoutes);
  await app.register(registerCupThingRoutes);
  await app.register(registerReviewRoutes);

  return app;
}
