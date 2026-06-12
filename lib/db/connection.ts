import type { PoolConfig } from "pg";

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Normalize Neon/Postgres URLs for the Node `pg` driver.
 * Strips channel_binding=require — it causes hangs/timeouts on many Windows setups.
 */
export function normalizeDatabaseUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  url.searchParams.delete("channel_binding");

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  if (!url.searchParams.has("uselibpqcompat")) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return normalizeDatabaseUrl(url);
}

export function getPgPoolConfig(): PoolConfig {
  return {
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
    idleTimeoutMillis: 300_000,
    max: 10,
  };
}

export function getDatabaseHost(): string | null {
  try {
    return new URL(process.env.DATABASE_URL?.trim() ?? "").hostname;
  } catch {
    return null;
  }
}
