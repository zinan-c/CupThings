import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadEnvFile, requireEnv } from "../env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

loadEnvFile(process.env.NODE_ENV === "test" ? ".env.test" : undefined);

const connectionString = process.env.NODE_ENV === "test"
  ? requireTestDatabaseUrl()
  : requireEnv("DATABASE_URL");

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

function requireTestDatabaseUrl() {
  const value = requireEnv("TEST_DATABASE_URL");
  const databaseName = new URL(value).pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must point to a database whose name ends with _test");
  }
  return value;
}
