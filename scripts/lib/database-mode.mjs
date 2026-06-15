const LOCAL_DATABASE_FLAGS = [
  "USE_LOCAL_DB",
  "LOCAL_DATABASE",
  "PGLITE",
  "USE_PGLITE",
];

const REMOTE_DATABASE_FLAGS = ["FORCE_REMOTE_DB", "USE_REMOTE_DB"];

function isEnvFlagEnabled(name) {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "true" || value === "1" || value === "yes";
}

export function hasPostgresDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim() ?? "";

  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

export function isExplicitLocalDatabaseRequested() {
  return LOCAL_DATABASE_FLAGS.some((flag) => isEnvFlagEnabled(flag));
}

function isRemoteDatabaseForced() {
  return REMOTE_DATABASE_FLAGS.some((flag) => isEnvFlagEnabled(flag));
}

export function isLocalDatabaseEnabled() {
  if (isRemoteDatabaseForced()) {
    return false;
  }

  if (hasPostgresDatabaseUrl()) {
    return false;
  }

  return isExplicitLocalDatabaseRequested();
}
