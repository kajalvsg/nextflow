import "server-only";

const LOCAL_DATABASE_FLAGS = [
  "USE_LOCAL_DB",
  "LOCAL_DATABASE",
  "PGLITE",
  "USE_PGLITE",
] as const;

function isEnvFlagEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "true" || value === "1" || value === "yes";
}

export function hasPostgresDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL?.trim() ?? "";

  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function isExplicitLocalDatabaseRequested(): boolean {
  return LOCAL_DATABASE_FLAGS.some((flag) => isEnvFlagEnabled(flag));
}

/**
 * Local PGlite is opt-in only. When DATABASE_URL points at Postgres/Neon,
 * always use the remote client even if a local flag is set.
 */
export function isLocalDatabaseEnabled(): boolean {
  if (hasPostgresDatabaseUrl()) {
    return false;
  }

  return isExplicitLocalDatabaseRequested();
}

export function getDatabaseMode(): "local" | "postgres" {
  return isLocalDatabaseEnabled() ? "local" : "postgres";
}
