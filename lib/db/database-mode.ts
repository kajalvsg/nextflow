import "server-only";

import {
  getRemoteAdapterLabel,
  getResolvedRemoteConnection,
  resolveRemoteDatabaseConnection,
  resetResolvedRemoteConnection,
} from "@/lib/db/neon-client";

const LOCAL_DATABASE_FLAGS = [
  "USE_LOCAL_DB",
  "LOCAL_DATABASE",
  "PGLITE",
  "USE_PGLITE",
] as const;

const REMOTE_DATABASE_FLAGS = ["FORCE_REMOTE_DB", "USE_REMOTE_DB"] as const;

const LOCAL_FALLBACK_FLAGS = [
  "USE_LOCAL_DB_FALLBACK",
  "LOCAL_DB_FALLBACK",
  "OFFLINE_DB_FALLBACK",
] as const;

let resolvedUseLocal: boolean | null = null;
let resolvePromise: Promise<"local" | "postgres"> | null = null;

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

function isRemoteDatabaseForced(): boolean {
  return REMOTE_DATABASE_FLAGS.some((flag) => isEnvFlagEnabled(flag));
}

function isLocalFallbackEnabled(): boolean {
  return LOCAL_FALLBACK_FLAGS.some((flag) => isEnvFlagEnabled(flag));
}

function setResolvedUseLocal(useLocal: boolean): void {
  resolvedUseLocal = useLocal;
}

export function isLocalDatabaseEnabled(): boolean {
  if (resolvedUseLocal !== null) {
    return resolvedUseLocal;
  }

  if (!hasPostgresDatabaseUrl()) {
    return isExplicitLocalDatabaseRequested();
  }

  return false;
}

export function isLocalDatabaseFallback(): boolean {
  return isLocalDatabaseEnabled() && hasPostgresDatabaseUrl();
}

export function getDatabaseMode(): "local" | "postgres" {
  return isLocalDatabaseEnabled() ? "local" : "postgres";
}

export function getDatabaseModeReason(): string {
  if (isRemoteDatabaseForced()) {
    return "FORCE_REMOTE_DB is set";
  }

  if (isLocalDatabaseFallback()) {
    return "local PGlite fallback (Neon unreachable — cloud workflows hidden)";
  }

  if (hasPostgresDatabaseUrl() && !isLocalDatabaseEnabled()) {
    const resolved = getResolvedRemoteConnection();

    if (resolved) {
      return `DATABASE_URL via ${getRemoteAdapterLabel(resolved.kind)} (shared with production)`;
    }

    return "DATABASE_URL (shared with production)";
  }

  if (isExplicitLocalDatabaseRequested()) {
    return "USE_LOCAL_DB without DATABASE_URL";
  }

  return "DATABASE_URL not configured";
}

export async function probeRemoteDatabase(
  timeoutMs = 8_000,
): Promise<boolean> {
  if (!hasPostgresDatabaseUrl()) {
    return false;
  }

  const resolved = await resolveRemoteDatabaseConnection(timeoutMs);
  return resolved !== null;
}

export async function resolveDatabaseBackend(): Promise<"local" | "postgres"> {
  if (resolvedUseLocal !== null) {
    return resolvedUseLocal ? "local" : "postgres";
  }

  if (resolvePromise) {
    return resolvePromise;
  }

  resolvePromise = (async () => {
    if (isRemoteDatabaseForced()) {
      setResolvedUseLocal(false);
      return "postgres";
    }

    if (!hasPostgresDatabaseUrl()) {
      const useLocal = isExplicitLocalDatabaseRequested();
      setResolvedUseLocal(useLocal);
      return useLocal ? "local" : "postgres";
    }

    if (process.env.NODE_ENV === "production") {
      setResolvedUseLocal(false);
      return "postgres";
    }

    if (isExplicitLocalDatabaseRequested() && !isRemoteDatabaseForced()) {
      setResolvedUseLocal(true);

      if (process.env.NODE_ENV === "development") {
        console.info(
          "[db] USE_LOCAL_DB=true — using local PGlite for app and Trigger.dev.",
        );
      }

      return "local";
    }

    const resolved = await resolveRemoteDatabaseConnection();

    if (resolved) {
      setResolvedUseLocal(false);

      if (process.env.NODE_ENV === "development") {
        console.info(
          `[db] Using DATABASE_URL via ${getRemoteAdapterLabel(resolved.kind)} — workflows shared with production.`,
        );
      }

      return "postgres";
    }

    if (isLocalFallbackEnabled() || isExplicitLocalDatabaseRequested()) {
      setResolvedUseLocal(true);
      console.warn(
        "[db] Neon unreachable — using local PGlite. Cloud workflows hidden until Neon connects.",
      );
      return "local";
    }

    setResolvedUseLocal(false);
    console.error(
      "[db] Neon unreachable. Wake your project at console.neon.tech, run npm run db:check, then restart. For offline dev, set USE_LOCAL_DB=true.",
    );
    return "postgres";
  })();

  return resolvePromise;
}

export function resetResolvedDatabaseBackend(): void {
  resolvedUseLocal = null;
  resolvePromise = null;
  resetResolvedRemoteConnection();
}
