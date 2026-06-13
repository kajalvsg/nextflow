import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let cachedProjectRoot: string | null = null;

function normalizePath(dir: string): string {
  return dir.replace(/\\/g, "/");
}

function isTriggerBuildDirectory(dir: string): boolean {
  const normalized = normalizePath(dir);
  return (
    normalized.includes("/.trigger/tmp/build-") ||
    normalized.endsWith("/.trigger/tmp/build") ||
    normalized.includes("\\.trigger\\tmp\\build-")
  );
}

function isNextflowProjectRoot(dir: string): boolean {
  if (isTriggerBuildDirectory(dir)) {
    return false;
  }

  const packageJsonPath = join(dir, "package.json");
  const prismaSchemaPath = join(dir, "prisma", "schema.prisma");
  const nextConfigPath = join(dir, "next.config.ts");
  const triggerConfigPath = join(dir, "trigger.config.ts");

  if (!existsSync(packageJsonPath) || !existsSync(prismaSchemaPath)) {
    return false;
  }

  if (!existsSync(nextConfigPath) && !existsSync(triggerConfigPath)) {
    return false;
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };

    return pkg.name === "nextflow";
  } catch {
    return false;
  }
}

/**
 * Resolve the repository root for filesystem paths.
 *
 * Trigger.dev local workers run from `.trigger/tmp/build-*`, where `process.cwd()`
 * is not the project root and the bundle may include package.json + prisma files.
 * Walk up and pick the outermost valid match so PGlite uses ./data/pglite.
 */
export function resolveProjectRoot(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  const explicitRoot = process.env.NEXTFLOW_PROJECT_ROOT?.trim();

  if (explicitRoot && isNextflowProjectRoot(explicitRoot)) {
    cachedProjectRoot = explicitRoot;
    return explicitRoot;
  }

  const initCwd = process.env.INIT_CWD?.trim();

  if (initCwd && isNextflowProjectRoot(initCwd)) {
    cachedProjectRoot = initCwd;
    return initCwd;
  }

  let current = process.cwd();
  let outermostMatch: string | null = null;

  for (let depth = 0; depth < 12; depth += 1) {
    if (isNextflowProjectRoot(current)) {
      outermostMatch = current;
    }

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  if (outermostMatch) {
    cachedProjectRoot = outermostMatch;
    return outermostMatch;
  }

  cachedProjectRoot = process.cwd();
  return cachedProjectRoot;
}

export function resetProjectRootCache(): void {
  cachedProjectRoot = null;
}
