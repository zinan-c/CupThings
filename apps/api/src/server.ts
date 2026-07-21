import { buildApp } from "./app.js";
import { pool } from "./db/client.js";

export async function startServer() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  let closing = false;

  await app.listen({ port, host });

  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
    await pool.end();
  };

  process.once("SIGTERM", close);
  process.once("SIGINT", close);
  return { app, close };
}

await startServer();
