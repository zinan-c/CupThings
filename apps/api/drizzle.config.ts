import { defineConfig } from "drizzle-kit";
import { loadEnvFile, requireEnv } from "./src/env";

loadEnvFile();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: requireEnv("DATABASE_URL")
  }
});
