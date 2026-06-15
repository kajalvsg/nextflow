export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // Defer DB bootstrap so app routes compile immediately in dev.
  void (async () => {
    const { resolveDatabaseBackend, getDatabaseModeReason } = await import(
      "@/lib/db/database-mode"
    );
    const { ensureDbReady } = await import("@/lib/db");

    await resolveDatabaseBackend();
    await ensureDbReady();

    if (process.env.NODE_ENV === "development") {
      console.info(`[db] ${getDatabaseModeReason()}`);
    }
  })();
}
