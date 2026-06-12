import "server-only";

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const LOCAL_DB_PATH = join(process.cwd(), "data", "pglite");
const INIT_SQL_PATH = join(process.cwd(), "prisma", "sql", "init.sql");

let pglite: PGlite | null = null;
let initialized = false;
let initPromise: Promise<PGlite> | null = null;

async function applySchema(db: PGlite): Promise<void> {
  const sql = readFileSync(INIT_SQL_PATH, "utf8");
  await db.exec(sql);
}

async function openPgliteDatabase(): Promise<PGlite> {
  mkdirSync(dirname(LOCAL_DB_PATH), { recursive: true });

  try {
    const db = await PGlite.create(LOCAL_DB_PATH);
    await db.query("SELECT 1 AS ok");
    return db;
  } catch (error) {
    console.warn(
      "[local-pglite] Failed to open database, resetting local data directory:",
      error instanceof Error ? error.message : error,
    );

    try {
      if (pglite) {
        await pglite.close();
      }
    } catch {
      // ignore close errors during recovery
    }

    pglite = null;
    rmSync(LOCAL_DB_PATH, { recursive: true, force: true });
    mkdirSync(dirname(LOCAL_DB_PATH), { recursive: true });

    const db = await PGlite.create(LOCAL_DB_PATH);
    await applySchema(db);
    await db.query("SELECT 1 AS ok");
    return db;
  }
}

export async function getLocalPglite(): Promise<PGlite> {
  if (pglite) {
    return pglite;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await openPgliteDatabase();

    if (!initialized) {
      await applySchema(db);
      initialized = true;
    }

    pglite = db;
    return db;
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    pglite = null;
    initialized = false;
    throw error;
  }
}

export async function initLocalDatabase(): Promise<PGlite> {
  return getLocalPglite();
}

export function isLocalDatabaseEnabled(): boolean {
  return process.env.USE_LOCAL_DB === "true";
}

export { LOCAL_DB_PATH };
