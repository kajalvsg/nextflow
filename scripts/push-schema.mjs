/**
 * Push schema to Neon via Node pg (IPv4-friendly).
 * Use when `prisma db push` fails with P1001 on networks without working IPv6.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: join(__dirname, "..", ".env.local") });
config({ path: join(__dirname, "..", ".env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = readFileSync(
  join(__dirname, "..", "prisma", "sql", "init.sql"),
  "utf8",
);

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 30_000,
});

try {
  console.log("Connecting to Neon (via Node pg)...");
  await client.connect();
  console.log("Connected. Applying schema...");
  await client.query(sql);
  console.log("✅ Schema applied successfully!");
  console.log("   Tables: Workflow, WorkflowRun, NodeExecution");
  console.log("\nNext: run `npm run db:generate` if you haven't already.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("❌ Failed to push schema:", message);
  console.error("\nTips:");
  console.error("  1. Wake your DB at https://console.neon.tech (run SELECT 1)");
  console.error("  2. Copy a fresh DATABASE_URL from Neon dashboard");
  console.error("  3. Check firewall/VPN isn't blocking port 5432");
  process.exit(1);
} finally {
  await client.end();
}
