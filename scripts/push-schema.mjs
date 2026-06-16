/**
 * Push schema via Node pg (Neon) or PGlite (local).
 * Use when `prisma db push` fails with P1001 on networks without working IPv6.
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  hasPostgresDatabaseUrl,
  isExplicitLocalDatabaseRequested,
  isLocalDatabaseEnabled,
  prefersLocalDatabaseInDev,
} from "./lib/database-mode.mjs";
import {
  normalizeDatabaseUrl,
  resolveRemoteDatabaseConnection,
} from "./lib/neon-probe.mjs";
import {
  closeLocalPglite,
  getInitSqlPath,
  openLocalPglite,
} from "./lib/pglite-local.mjs";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

config({ path: join(rootDir, ".env.local") });
config({ path: join(rootDir, ".env") });

const sql = readFileSync(getInitSqlPath(rootDir), "utf8");

async function pushToLocalDatabase() {
  const { db, dbPath } = await openLocalPglite(rootDir);

  try {
    console.log(`Applying schema to local PGlite at ${dbPath}...`);
    await db.exec(sql);
    console.log("✅ Schema applied successfully!");
    console.log("   Tables: Workflow, WorkflowRun, NodeExecution");
    console.log("\nNext: run `npm run db:generate` if you haven't already.");
  } finally {
    await closeLocalPglite(db);
  }
}

async function pushToRemoteDatabase(connectionString) {
  const host = new URL(connectionString).hostname;

  console.log(`Connecting to Neon/Postgres host: ${host}...`);

  if (connectionString.includes("channel_binding")) {
    console.log(
      "Note: removed channel_binding from connection URL (not supported by Node pg).",
    );
  }

  const resolved = await resolveRemoteDatabaseConnection(12_000);

  if (!resolved) {
    throw new Error("Could not reach database after multiple attempts.");
  }

  const client = new pg.Client({
    connectionString: normalizeDatabaseUrl(resolved.connectionString),
    connectionTimeoutMillis: 30_000,
  });

  try {
    await client.connect();
    console.log(`Connected via ${resolved.kind}. Applying schema...`);
    await client.query(sql);
    console.log("✅ Schema applied successfully!");
    console.log("   Tables: Workflow, WorkflowRun, NodeExecution");
    console.log("\nNext: run `npm run db:generate` if you haven't already.");
  } finally {
    await client.end();
  }
}

try {
  if (isLocalDatabaseEnabled() || prefersLocalDatabaseInDev()) {
    await pushToLocalDatabase();
    process.exit(0);
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in .env.local");
    console.error("   Tip: set USE_LOCAL_DB=true for offline local development.");
    process.exit(1);
  }

  if (!hasPostgresDatabaseUrl()) {
    console.error("❌ DATABASE_URL must start with postgresql:// or postgres://");
    process.exit(1);
  }

  try {
    await pushToRemoteDatabase(connectionString);
  } catch (remoteError) {
    if (!isExplicitLocalDatabaseRequested()) {
      throw remoteError;
    }

    console.warn(
      "\n⚠ Neon unreachable — applying schema to local PGlite fallback…",
    );
    await pushToLocalDatabase();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ Failed to push schema:", message || "(connection timeout)");

  console.error("\nQuick fix for local development (no Neon required):");
  console.error("  1. Stop npm run dev and npm run trigger:dev");
  console.error("  2. Run: npm run db:push");
  console.error("  3. Restart: npm run dev");

  process.exit(1);
}
