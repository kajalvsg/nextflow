import "server-only";

import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import type { PoolConfig } from "pg";
import type { Prisma } from "@prisma/client";
import ws from "ws";
import { getDatabaseUrl, normalizeDatabaseUrl } from "@/lib/db/connection";

export type RemoteAdapterKind = "pg" | "neon-http" | "neon-ws";

export interface ResolvedRemoteConnection {
  kind: RemoteAdapterKind;
  connectionString: string;
}

const DEFAULT_PROBE_TIMEOUT_MS = 8_000;

let neonConfigured = false;
let resolvedConnection: ResolvedRemoteConnection | null = null;
let resolveConnectionPromise: Promise<ResolvedRemoteConnection | null> | null =
  null;

export function isNeonDatabaseUrl(url?: string): boolean {
  const value = (url ?? process.env.DATABASE_URL?.trim() ?? "").replace(
    /^postgres:\/\//,
    "postgresql://",
  );

  if (!value.startsWith("postgresql://")) {
    return false;
  }

  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.includes("neon.tech") || host.endsWith(".neon.build");
  } catch {
    return false;
  }
}

export function getDirectNeonDatabaseUrl(url?: string): string | null {
  const raw = url ?? process.env.DATABASE_URL?.trim();

  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(normalizeDatabaseUrl(raw));

    if (!parsed.hostname.includes("-pooler")) {
      return null;
    }

    parsed.hostname = parsed.hostname.replace("-pooler", "");
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildConnectionUrlCandidates(primaryUrl?: string): string[] {
  const primary = normalizeDatabaseUrl(primaryUrl ?? getDatabaseUrl());
  const candidates = [primary];

  if (isNeonDatabaseUrl(primary)) {
    const directUrl = getDirectNeonDatabaseUrl(primary);

    if (directUrl && directUrl !== primary) {
      candidates.push(directUrl);
    }
  }

  return candidates;
}

function configureNeonDriver(): void {
  if (neonConfigured) {
    return;
  }

  neonConfig.webSocketConstructor = ws;
  neonConfigured = true;
}

function probeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database probe timed out")), timeoutMs);
    }),
  ]);
}

export async function probePgDatabase(
  connectionString: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: normalizeDatabaseUrl(connectionString),
    connectionTimeoutMillis: timeoutMs,
    keepAlive: true,
  });

  try {
    await probeWithTimeout(() => client.connect(), timeoutMs);
    await probeWithTimeout(() => client.query("SELECT 1 AS ok"), timeoutMs);
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function probeNeonHttpDatabase(
  connectionString: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const sql = neon(normalizeDatabaseUrl(connectionString));
    const result = await probeWithTimeout(
      () => sql`SELECT 1 AS ok`,
      timeoutMs,
    );

    return Array.isArray(result) ? result.length > 0 : Boolean(result);
  } catch {
    return false;
  }
}

export async function probeNeonWebSocketDatabase(
  connectionString: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  configureNeonDriver();

  let pool: Pool | null = null;

  try {
    pool = new Pool({
      connectionString: normalizeDatabaseUrl(connectionString),
    });

    const result = await probeWithTimeout(
      () => pool!.query("SELECT 1 AS ok"),
      timeoutMs,
    );

    return Boolean(result.rows?.[0]);
  } catch {
    return false;
  } finally {
    await pool?.end().catch(() => undefined);
  }
}

function getPgPoolConfigForUrl(connectionString: string): PoolConfig {
  return {
    connectionString: normalizeDatabaseUrl(connectionString),
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 300_000,
    max: 10,
    keepAlive: true,
  };
}

const REMOTE_STRATEGIES: Array<{
  kind: RemoteAdapterKind;
  probe: (connectionString: string, timeoutMs: number) => Promise<boolean>;
  neonOnly?: boolean;
}> = [
  { kind: "pg", probe: probePgDatabase },
  { kind: "neon-http", probe: probeNeonHttpDatabase, neonOnly: true },
  { kind: "neon-ws", probe: probeNeonWebSocketDatabase, neonOnly: true },
];

export async function resolveRemoteDatabaseConnection(
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<ResolvedRemoteConnection | null> {
  if (resolvedConnection) {
    return resolvedConnection;
  }

  if (resolveConnectionPromise) {
    return resolveConnectionPromise;
  }

  resolveConnectionPromise = (async () => {
    const candidates = buildConnectionUrlCandidates();
    // Prefer TCP pg — most reliable in Node/Trigger workers. Avoid neon-ws in bundled workers.
    const priorityOrder: RemoteAdapterKind[] = ["pg", "neon-http"];

    const probeResults = await Promise.all(
      candidates.flatMap((connectionString) => {
        const neonUrl = isNeonDatabaseUrl(connectionString);

        return REMOTE_STRATEGIES.filter(
          (strategy) => !strategy.neonOnly || neonUrl,
        ).map(async (strategy) => ({
          kind: strategy.kind,
          connectionString,
          ok: await strategy.probe(connectionString, timeoutMs),
        }));
      }),
    );

    for (const connectionString of candidates) {
      for (const kind of priorityOrder) {
        const match = probeResults.find(
          (result) =>
            result.connectionString === connectionString &&
            result.kind === kind &&
            result.ok,
        );

        if (!match) {
          continue;
        }

        const candidate: ResolvedRemoteConnection = {
          kind: match.kind,
          connectionString,
        };

        resolvedConnection = candidate;
        return resolvedConnection;
      }
    }

    return null;
  })();

  return resolveConnectionPromise;
}

export function getResolvedRemoteConnection(): ResolvedRemoteConnection | null {
  return resolvedConnection;
}

export function getDefaultRemoteConnection(): ResolvedRemoteConnection {
  return {
    kind: "pg",
    connectionString: getDatabaseUrl(),
  };
}

export function getRemoteAdapterLabel(kind: RemoteAdapterKind): string {
  switch (kind) {
    case "pg":
      return "TCP (pg)";
    case "neon-http":
      return "Neon HTTP";
    case "neon-ws":
      return "Neon WebSocket";
    default:
      return kind;
  }
}

export function createRemotePrismaAdapter(
  connection: ResolvedRemoteConnection = getResolvedRemoteConnection() ??
    getDefaultRemoteConnection(),
): NonNullable<Prisma.PrismaClientOptions["adapter"]> {
  switch (connection.kind) {
    case "pg":
      return new PrismaPg(getPgPoolConfigForUrl(connection.connectionString));
    case "neon-http":
      return new PrismaNeonHTTP(connection.connectionString, {
        arrayMode: false,
        fullResults: true,
      });
    case "neon-ws":
      configureNeonDriver();
      return new PrismaNeon({
        connectionString: connection.connectionString,
      });
    default: {
      const _exhaustive: never = connection.kind;
      return _exhaustive;
    }
  }
}

export function resetResolvedRemoteConnection(): void {
  resolvedConnection = null;
  resolveConnectionPromise = null;
}
