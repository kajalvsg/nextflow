import type { NextConfig } from "next";

function parseDevOrigins(): string[] {
  const fromEnv =
    process.env.ALLOWED_DEV_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return [
    "localhost",
    "127.0.0.1",
    // Common LAN dev hosts — extend via ALLOWED_DEV_ORIGINS in .env.local
    "10.65.161.206",
    "10.59.110.206",
    "10.96.227.206",
    ...fromEnv,
  ];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: parseDevOrigins(),
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pglite-prisma-adapter",
    "@prisma/adapter-pg",
    "pg",
  ],
};

export default nextConfig;
