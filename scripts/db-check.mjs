import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

function normalizeDatabaseUrl(rawUrl) {
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

async function checkLocalDatabase() {
  const dbPath = join(process.cwd(), "data", "pglite");
  const { mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(dbPath), { recursive: true });

  console.log(`Checking local PGlite database at ${dbPath}`);

  const db = await PGlite.create(dbPath);
  const sql = readFileSync(join(process.cwd(), "prisma", "sql", "init.sql"), "utf8");
  await db.exec(sql);

  const result = await db.query("SELECT 1 AS ok");
  console.log("✅ Local database reachable:", result.rows[0]);

  const tables = await db.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('Workflow', 'WorkflowRun', 'NodeExecution')
    ORDER BY tablename
  `);

  const found = tables.rows.map((row) => row.tablename);
  console.log("Tables found:", found.length ? found.join(", ") : "(none yet)");
  await db.close();
}

async function checkRemoteDatabase(connectionString) {
  const host = new URL(connectionString).hostname;
  const normalized = normalizeDatabaseUrl(connectionString);

  console.log(`Checking Neon/Postgres host: ${host}`);

  if (connectionString.includes("channel_binding")) {
    console.log("Note: removed channel_binding from connection URL (not supported by Node pg).");
  }

  const client = new pg.Client({
    connectionString: normalized,
    connectionTimeoutMillis: 20_000,
  });

  try {
    console.log("Connecting...");
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

    const found = tables.rows.map((row) => row.tablename);
    console.log("Tables found:", found.length ? found.join(", ") : "(none yet)");

    if (found.length < 3) {
      console.log("\nSchema missing or incomplete. Run:");
      console.log("  npm run db:push");
    }
  } finally {
    await client.end();
  }
}

try {
  if (process.env.USE_LOCAL_DB === "true") {
    await checkLocalDatabase();
    process.exit(0);
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in .env.local");
    console.error("   Tip: set USE_LOCAL_DB=true for offline local development.");
    process.exit(1);
  }

  await checkRemoteDatabase(connectionString);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ Database check failed:", message);

  if (process.env.USE_LOCAL_DB !== "true") {
    console.error("\nQuick fix for local development (no Neon required):");
    console.error("  1. Add USE_LOCAL_DB=true to .env.local");
    console.error("  2. Run: npm run db:check");
    console.error("  3. Restart: npm run dev");
    console.error("\nOr fix Neon:");
    console.error("  1. Open https://console.neon.tech and wake your project");
    console.error("  2. Copy a fresh *pooled* connection string (no channel_binding=require)");
    console.error("  3. Update DATABASE_URL in .env.local");
    console.error("  4. Run: npm run db:push");
  }

  process.exit(1);
}
