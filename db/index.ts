import "server-only";
import { Pool } from "pg";
import { Database, type DatabaseConnection } from "./adapter";
import { databaseConnectionConfig } from "./config";

let pool: Pool | undefined;
let database: Database | undefined;

export function getDatabase(): Database {
  if (database) return database;
  pool = new Pool(databaseConnectionConfig(process.env));
  pool.on("error", () => { console.error("ParkSarthi database connection failed."); });
  const currentPool = pool;
  database = new Database({
    async query(sql, values) {
      const client = await currentPool.connect();
      try {
        await client.query("SET search_path TO parksarthi, public");
        return await client.query(sql, values);
      } finally { client.release(); }
    },
  }, async () => await currentPool.connect() as DatabaseConnection);
  return database;
}

export async function closeDatabase() {
  const currentPool = pool; pool = undefined; database = undefined;
  await currentPool?.end();
}
