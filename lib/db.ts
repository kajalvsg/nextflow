import { prisma, initializeLocalPrisma } from "@/lib/prisma";
import {
  initLocalDatabase,
  isLocalDatabaseEnabled,
} from "@/lib/db/local-pglite";

let localDbReady: Promise<void> | null = null;

export async function ensureDbReady(): Promise<void> {
  if (!isLocalDatabaseEnabled()) {
    return;
  }

  localDbReady ??= (async () => {
    const pglite = await initLocalDatabase();
    initializeLocalPrisma(pglite);
  })();

  try {
    await localDbReady;
  } catch (error) {
    localDbReady = null;
    throw error;
  }
}

export async function getDb() {
  await ensureDbReady();
  return prisma;
}

export const db = prisma;

export default db;
