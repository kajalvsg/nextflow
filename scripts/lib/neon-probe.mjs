import ws from "ws";
import { neon, neonConfig, Pool } from "@neondatabase/serverless";

let neonConfigured = false;

export function isNeonDatabaseUrl(url) {
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

export function getDirectNeonDatabaseUrl(url) {
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

export function normalizeDatabaseUrl(rawUrl) {
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

function configureNeonDriver() {
  if (neonConfigured) {
    return;
  }

  neonConfig.webSocketConstructor = ws;
  neonConfigured = true;
}

function probeWithTimeout(operation, timeoutMs) {
  return Promise.race([
    operation(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database probe timed out")), timeoutMs);
    }),
  ]);
}

export async function probePgDatabase(connectionString, timeoutMs = 8_000) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
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

export async function probeNeonHttpDatabase(connectionString, timeoutMs = 8_000) {
  try {
    const sql = neon(normalizeDatabaseUrl(connectionString));
    const result = await probeWithTimeout(() => sql`SELECT 1 AS ok`, timeoutMs);
    return Array.isArray(result) ? result.length > 0 : Boolean(result);
  } catch {
    return false;
  }
}

export async function probeNeonWebSocketDatabase(connectionString, timeoutMs = 8_000) {
  configureNeonDriver();

  let pool = null;

  try {
    pool = new Pool({
      connectionString: normalizeDatabaseUrl(connectionString),
    });

    const result = await probeWithTimeout(
      () => pool.query("SELECT 1 AS ok"),
      timeoutMs,
    );

    return Boolean(result.rows?.[0]);
  } catch {
    return false;
  } finally {
    await pool?.end().catch(() => undefined);
  }
}

const REMOTE_STRATEGIES = [
  { kind: "pg", probe: probePgDatabase },
  { kind: "neon-http", probe: probeNeonHttpDatabase, neonOnly: true },
  { kind: "neon-ws", probe: probeNeonWebSocketDatabase, neonOnly: true },
];

export async function resolveRemoteDatabaseConnection(timeoutMs = 8_000) {
  const primaryUrl = process.env.DATABASE_URL?.trim();

  if (!primaryUrl) {
    return null;
  }

  const candidates = [normalizeDatabaseUrl(primaryUrl)];

  if (isNeonDatabaseUrl(primaryUrl)) {
    const directUrl = getDirectNeonDatabaseUrl(primaryUrl);

    if (directUrl && directUrl !== candidates[0]) {
      candidates.push(directUrl);
    }
  }

  const priorityOrder = ["pg", "neon-http", "neon-ws"];

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

      if (match) {
        return {
          kind: match.kind,
          connectionString,
        };
      }
    }
  }

  return null;
}

export async function probeRemoteDatabase(timeoutMs = 8_000) {
  const resolved = await resolveRemoteDatabaseConnection(timeoutMs);
  return resolved !== null;
}

export function getRemoteAdapterLabel(kind) {
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
