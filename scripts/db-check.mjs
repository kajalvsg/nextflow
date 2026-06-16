import { config } from "dotenv";
import pg from "pg";
import {
  hasPostgresDatabaseUrl,
  isExplicitLocalDatabaseRequested,
  isLocalDatabaseEnabled,
  prefersLocalDatabaseInDev,
} from "./lib/database-mode.mjs";
import {
  getRemoteAdapterLabel,
  normalizeDatabaseUrl,
  resolveRemoteDatabaseConnection,
} from "./lib/neon-probe.mjs";
import {
  closeLocalPglite,
  ensureLocalSchema,
  listCoreTables,
  openLocalPglite,
} from "./lib/pglite-local.mjs";

config({ path: ".env.local" });
config({ path: ".env" });

async function checkLocalDatabase() {
  const { db, dbPath } = await openLocalPglite(process.cwd());

  try {
    console.log(`Checking local PGlite database at ${dbPath}`);

    const schemaApplied = await ensureLocalSchema(db, process.cwd());

    if (schemaApplied) {
      console.log("Applied local schema (first run).");
    }

    const result = await db.query("SELECT 1 AS ok");
    console.log("✅ Local database reachable:", result.rows[0]);

    const found = await listCoreTables(db);
    console.log("Tables found:", found.length ? found.join(", ") : "(none yet)");

    if (found.length < 3) {
      console.log("\nSchema missing or incomplete. Run:");
      console.log("  npm run db:push");
    }
  } finally {
    await closeLocalPglite(db);
  }
}

async function listRemoteTablesPg(connectionString) {
  const client = new pg.Client({
    connectionString: normalizeDatabaseUrl(connectionString),
    connectionTimeoutMillis: 20_000,
  });

  try {
    await client.connect();
    const result = await client.query("SELECT 1 AS ok");
    console.log("✅ Database reachable:", result.rows[0]);

    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('Workflow', 'WorkflowRun', 'NodeExecution')
      ORDER BY tablename
    `);

    return tables.rows.map((row) => row.tablename);
  } finally {
    await client.end();
  }
}

async function listRemoteTablesNeonHttp(connectionString) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(normalizeDatabaseUrl(connectionString));
  const result = await sql`SELECT 1 AS ok`;
  console.log("✅ Database reachable:", result[0] ?? result);

  const tables = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('Workflow', 'WorkflowRun', 'NodeExecution')
    ORDER BY tablename
  `;

  return tables.map((row) => row.tablename);
}

async function checkRemoteDatabase(connectionString) {
  const host = new URL(connectionString).hostname;

  console.log(`Checking Neon/Postgres host: ${host}`);
  console.log("Connecting (TCP → Neon HTTP)…");

  const resolved = await resolveRemoteDatabaseConnection();

  if (!resolved) {
    throw new Error("Could not reach database after multiple attempts.");
  }

  console.log(`Using ${getRemoteAdapterLabel(resolved.kind)} adapter`);

  const found =
    resolved.kind === "pg"
      ? await listRemoteTablesPg(resolved.connectionString)
      : await listRemoteTablesNeonHttp(resolved.connectionString);

  console.log("Tables found:", found.length ? found.join(", ") : "(none yet)");

  if (found.length < 3) {
    console.log("\nSchema missing or incomplete. Run:");
    console.log("  npm run db:push");
  }
}

try {
  if (isLocalDatabaseEnabled() || prefersLocalDatabaseInDev()) {
    if (prefersLocalDatabaseInDev() && hasPostgresDatabaseUrl()) {
      console.log(
        "USE_LOCAL_DB=true — checking local PGlite (Neon skipped in dev).",
      );
    }

    await checkLocalDatabase();
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
    await checkRemoteDatabase(connectionString);
    process.exit(0);
  } catch (remoteError) {
    if (!isExplicitLocalDatabaseRequested()) {
      throw remoteError;
    }

    console.warn(
      "\n⚠ Neon unreachable — checking local PGlite fallback (USE_LOCAL_DB=true)…",
    );
    await checkLocalDatabase();
    process.exit(0);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ Database check failed:", message);

  console.error("\nQuick fix for local development (no Neon required):");
  console.error("  1. Stop npm run dev and npm run trigger:dev");
  console.error("  2. Run: npm run db:push");
  console.error("  3. Run: npm run db:check");
  console.error("  4. Restart: npm run dev");
  console.error("\nOr fix Neon:");
  console.error("  1. Open https://console.neon.tech and wake your project");
  console.error("  2. Copy a fresh *pooled* connection string (no channel_binding=require)");
  console.error("  3. Update DATABASE_URL in .env.local");
  console.error("  4. Run: npm run db:push");

  process.exit(1);
}
