/**
 * Push schema via Node pg (Neon) or PGlite (local).
 * Use when `prisma db push` fails with P1001 on networks without working IPv6.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const initSqlPath = join(rootDir, "prisma", "sql", "init.sql");

config({ path: join(rootDir, ".env.local") });
config({ path: join(rootDir, ".env") });

const sql = readFileSync(initSqlPath, "utf8");

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

async function pushToLocalDatabase() {
  const dbPath = join(rootDir, "data", "pglite");
  mkdirSync(dirname(dbPath), { recursive: true });

  console.log(`Applying schema to local PGlite at ${dbPath}...`);
  const db = await PGlite.create(dbPath);
  await db.exec(sql);
  await db.close();

  console.log("✅ Schema applied successfully!");
  console.log("   Tables: Workflow, WorkflowRun, NodeExecution");
  console.log("\nNext: run `npm run db:generate` if you haven't already.");
}

async function pushToRemoteDatabase(connectionString) {
  const host = new URL(connectionString).hostname;
  const normalized = normalizeDatabaseUrl(connectionString);

  console.log(`Connecting to Neon/Postgres host: ${host}...`);

  if (connectionString.includes("channel_binding")) {
    console.log("Note: removed channel_binding from connection URL (not supported by Node pg).");
  }

  const client = new pg.Client({
    connectionString: normalized,
    connectionTimeoutMillis: 30_000,
  });

  try {
    await client.connect();
    console.log("Connected. Applying schema...");
    await client.query(sql);
    console.log("✅ Schema applied successfully!");
    console.log("   Tables: Workflow, WorkflowRun, NodeExecution");
    console.log("\nNext: run `npm run db:generate` if you haven't already.");
  } finally {
    await client.end();
  }
}

try {
  if (process.env.USE_LOCAL_DB === "true") {
    await pushToLocalDatabase();
    process.exit(0);
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in .env.local");
    console.error("   Tip: set USE_LOCAL_DB=true for offline local development.");
    process.exit(1);
  }

  await pushToRemoteDatabase(connectionString);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ Failed to push schema:", message || "(connection timeout)");

  if (process.env.USE_LOCAL_DB !== "true") {
    console.error("\nQuick fix for local development (no Neon required):");
    console.error("  1. Add USE_LOCAL_DB=true to .env.local");
    console.error("  2. Run: npm run db:push");
    console.error("  3. Restart: npm run dev");
    console.error("\nOr fix Neon:");
    console.error("  1. Wake your DB at https://console.neon.tech (run SELECT 1)");
    console.error("  2. Copy a fresh DATABASE_URL from Neon dashboard");
    console.error("  3. Check firewall/VPN isn't blocking port 5432");
  }

  process.exit(1);
}
