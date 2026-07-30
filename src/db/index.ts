import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// next dev/build/start already load .env.local; this is a no-op there
// (dotenv never overwrites an existing var) and the only thing standalone
// scripts (tsx scripts/seed.ts) need to pick up DATABASE_URL.
config({ path: ".env.local" });

// Neon Postgres. Swapping to a different branch/project is just a
// DATABASE_URL change (e.g. a Neon preview branch per environment) — no
// code change required.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
