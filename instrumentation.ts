export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { getDatabaseMode, isLocalDatabaseEnabled } = await import(
    "@/lib/db/database-mode"
  );

  if (!isLocalDatabaseEnabled()) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[db] Using ${getDatabaseMode()} database (DATABASE_URL).`);
    }

    return;
  }

  const { ensureDbReady } = await import("@/lib/db");
  await ensureDbReady();

  if (process.env.NODE_ENV === "development") {
    console.info("[db] Using local PGlite database.");
  }
}
