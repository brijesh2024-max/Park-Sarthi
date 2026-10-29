export type DatabaseEnvironment = { DATABASE_URL?: string; DATABASE_SSL_CA?: string; DATABASE_POOL_MAX?: string; NODE_ENV?: string };

export function databaseConnectionConfig(env: DatabaseEnvironment) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use PostgreSQL.");
  const mode = url.searchParams.get("sslmode");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const plaintextLocal = local && env.NODE_ENV !== "production" && mode === "disable";
  if (mode && !["require", "verify-full"].includes(mode) && !plaintextLocal) {
    throw new Error("Remote PostgreSQL connections require verified TLS (sslmode=verify-full).");
  }
  // Connection-string TLS options otherwise override node-postgres's explicit policy.
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) url.searchParams.delete(key);
  const configuredMax = Number(env.DATABASE_POOL_MAX ?? 5);
  if (!Number.isInteger(configuredMax) || configuredMax < 1 || configuredMax > 20) throw new Error("DATABASE_POOL_MAX must be between 1 and 20.");
  return {
    connectionString: url.toString(),
    ssl: plaintextLocal ? false as const : { rejectUnauthorized: true, ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA.replaceAll("\\n", "\n") } : {}) },
    max: configuredMax,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
    application_name: "parksarthi",
  };
}
