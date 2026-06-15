import { rmSync } from "node:fs";
import { join } from "node:path";

const cacheDir = join(process.cwd(), ".next");

try {
  rmSync(cacheDir, { recursive: true, force: true });
  console.log(`Removed ${cacheDir}`);
} catch (error) {
  console.warn(
    "Could not remove .next cache:",
    error instanceof Error ? error.message : error,
  );
}
