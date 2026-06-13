import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_alwnrsxdtapnxqezdbel",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  dirs: ["./trigger"],
  build: {
    // PGlite is WASM-based; bundling it breaks pglite.data resolution in .trigger/tmp/build-*.
    external: ["@electric-sql/pglite", "pglite-prisma-adapter"],
  },
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
