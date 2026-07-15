import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { loadEnvFile, requireEnv } from "../env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

loadEnvFile();

export const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
export const db = drizzle(pool, { schema });
