import { withTimeout } from "@/lib/utils/with-timeout";

const DEFAULT_POLL_TIMEOUT_MS = 15_000;

export async function pollServerAction<T>(
  label: string,
  action: () => Promise<T>,
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
): Promise<T> {
  try {
    return await withTimeout(action(), timeoutMs, label);
  } catch (error) {
    console.error(`[poll] ${label} failed:`, error);
    throw error;
  }
}
