import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const OPEN_MAX_ATTEMPTS = 10;
const RETRYABLE_PATTERN = /aborted|locked|busy|resource/i;

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

export function getLocalDbPath(rootDir = process.cwd()) {
  return resolve(rootDir, "data", "pglite");
}

export function getInitSqlPath(rootDir = process.cwd()) {
  return join(rootDir, "prisma", "sql", "init.sql");
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function isRetryablePgliteError(error) {
  return RETRYABLE_PATTERN.test(getErrorMessage(error).toLowerCase());
}

function hasPgliteDataFiles(dbPath) {
  return (
    existsSync(join(dbPath, "PG_VERSION")) ||
    existsSync(join(dbPath, "base")) ||
    existsSync(join(dbPath, "global"))
  );
}

/**
 * Open on-disk PGlite with retries. Recreates the data directory once if corrupted.
 */
export async function openLocalPglite(rootDir = process.cwd()) {
  const dbPath = getLocalDbPath(rootDir);
  mkdirSync(dbPath, { recursive: true });

  let recreated = false;

  for (let attempt = 1; attempt <= OPEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const db = await PGlite.create(dbPath);
      await db.query("SELECT 1 AS ok");
      return { db, dbPath };
    } catch (error) {
      const retryable = isRetryablePgliteError(error);

      if (!recreated && retryable && attempt >= Math.floor(OPEN_MAX_ATTEMPTS / 2)) {
        console.warn(
          `[pglite] Local database at ${dbPath} may be corrupted or locked — recreating…`,
        );
        console.warn(
          "[pglite] Stop npm run dev and npm run trigger:dev before db:check if recreation fails.",
        );

        try {
          rmSync(dbPath, { recursive: true, force: true });
        } catch {
          // Another process may still hold the directory.
        }

        mkdirSync(dbPath, { recursive: true });
        recreated = true;
        await wait(500);
        continue;
      }

      if (retryable && attempt < OPEN_MAX_ATTEMPTS) {
        console.warn(
          `[pglite] Open attempt ${attempt}/${OPEN_MAX_ATTEMPTS} failed (${getErrorMessage(error)}), retrying…`,
        );
        await wait(300 * attempt);
        continue;
      }

      if (retryable && hasPgliteDataFiles(dbPath)) {
        throw new Error(
          `Local PGlite is locked or in use (another dev/trigger process may be running). Stop npm run dev and npm run trigger:dev, then run npm run db:check again. Original: ${getErrorMessage(error)}`,
        );
      }

      throw error;
    }
  }

  throw new Error("Failed to open local PGlite database.");
}

export async function ensureLocalSchema(db, rootDir = process.cwd()) {
  const existing = await db.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'Workflow'
  `);

  if (existing.rows.length > 0) {
    return false;
  }

  const initSqlPath = getInitSqlPath(rootDir);
  const sql = readFileSync(initSqlPath, "utf8");
  await db.exec(sql);
  return true;
}

export async function listCoreTables(db) {
  const tables = await db.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('Workflow', 'WorkflowRun', 'NodeExecution')
    ORDER BY tablename
  `);

  return tables.rows.map((row) => row.tablename);
}

export async function closeLocalPglite(db) {
  if (!db) {
    return;
  }

  try {
    await db.close();
  } catch {
    // Ignore close errors during checks.
  }
}
