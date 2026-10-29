import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { databaseConnectionConfig } from "../db/config.ts";

const client = new pg.Client(databaseConnectionConfig(process.env));
try {
  await client.connect();
  // One runner at a time. Each migration owns its transaction so the same SQL
  // files can also be applied directly in the Supabase SQL Editor.
  await client.query("SELECT pg_advisory_lock(761902804)");
  await client.query("CREATE SCHEMA IF NOT EXISTS parksarthi");
  await client.query("REVOKE ALL ON SCHEMA parksarthi FROM PUBLIC");
  await client.query("CREATE TABLE IF NOT EXISTS parksarthi.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  const root = new URL("../postgres/", import.meta.url);
  for (const name of (await readdir(root)).filter(name => /^\d+_[a-z_]+\.sql$/.test(name)).sort()) {
    const sql = await readFile(new URL(name, root), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM parksarthi.schema_migrations WHERE name=$1", [name]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration ${name} has changed. Add a new migration instead.`);
      console.log(`Already applied: ${name}`);
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO parksarthi.schema_migrations(name,checksum) VALUES($1,$2)", [name, checksum]);
    console.log(`Applied: ${name}`);
  }
} catch (error) {
  // Do not expose database URLs/passwords in deployment logs.
  console.error(error instanceof Error && error.message.startsWith("Applied migration")
    ? error.message : "Database migration failed. Check database access, TLS and the SQL migration files.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
