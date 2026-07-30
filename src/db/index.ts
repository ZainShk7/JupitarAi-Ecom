import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Same driver for local dev and Turso prod — only DATABASE_URL changes.
// Local default is a file under ./data, so it never collides with a
// checked-in path and is gitignored.
const url = process.env.DATABASE_URL ?? "file:./data/jupitar.db";

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
