const LOCAL_DATABASE_FLAGS = [
  "USE_LOCAL_DB",
  "LOCAL_DATABASE",
  "PGLITE",
  "USE_PGLITE",
];

function isEnvFlagEnabled(name) {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "true" || value === "1" || value === "yes";
}

export function hasPostgresDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? "";

  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function isExplicitLocalDatabaseRequested() {
  return LOCAL_DATABASE_FLAGS.some((flag) => isEnvFlagEnabled(flag));
}

export function isLocalDatabaseEnabled() {
  if (hasPostgresDatabaseUrl()) {
    return false;
  }

  return isExplicitLocalDatabaseRequested();
}
