export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.USE_LOCAL_DB !== "true") {
    return;
  }

  const { ensureDbReady } = await import("@/lib/db");
  await ensureDbReady();
}
