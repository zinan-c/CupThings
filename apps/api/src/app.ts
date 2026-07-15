import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerCupThingRoutes } from "./routes/cup-things.js";
import { registerProfileRoutes } from "./routes/profiles.js";
import { registerReviewRoutes } from "./routes/reviews.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173"
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(registerProfileRoutes);
  await app.register(registerCupThingRoutes);
  await app.register(registerReviewRoutes);

  return app;
}
