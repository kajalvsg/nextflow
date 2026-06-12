import "server-only";

import type { PGlite } from "@electric-sql/pglite";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { getPgPoolConfig } from "@/lib/db/connection";
import { isLocalDatabaseEnabled } from "@/lib/db/local-pglite";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaMode: "local" | "remote" | undefined;
  localPgliteInstance: PGlite | undefined;
};

function createRemotePrismaClient(): PrismaClient {
  const adapter = new PrismaPg(getPgPoolConfig());

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function createLocalPrismaClient(pglite: PGlite): PrismaClient {
  const adapter = new PrismaPGlite(
    pglite,
  ) as unknown as NonNullable<Prisma.PrismaClientOptions["adapter"]>;

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function resetLocalPrismaClient(): void {
  const existing = globalForPrisma.prisma;

  if (existing && globalForPrisma.prismaMode === "local") {
    void existing.$disconnect().catch(() => {
      // Ignore disconnect errors during recovery.
    });
  }

  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaMode = undefined;
  globalForPrisma.localPgliteInstance = undefined;
}

export function initializeLocalPrisma(pglite: PGlite): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaMode === "local" &&
    globalForPrisma.localPgliteInstance === pglite
  ) {
    return globalForPrisma.prisma;
  }

  resetLocalPrismaClient();

  const client = createLocalPrismaClient(pglite);
  globalForPrisma.prisma = client;
  globalForPrisma.prismaMode = "local";
  globalForPrisma.localPgliteInstance = pglite;

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.localPgliteInstance = pglite;
  }

  return client;
}

function getRemotePrismaClient(): PrismaClient {
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaMode !== "remote"
  ) {
    globalForPrisma.prisma = createRemotePrismaClient();
    globalForPrisma.prismaMode = "remote";
  }

  return globalForPrisma.prisma;
}

if (!isLocalDatabaseEnabled()) {
  getRemotePrismaClient();
}

function getActivePrismaClient(): PrismaClient {
  if (isLocalDatabaseEnabled()) {
    if (!globalForPrisma.prisma || globalForPrisma.prismaMode !== "local") {
      throw new Error(
        "Local database is not ready. Call ensureDbReady() before using Prisma.",
      );
    }

    return globalForPrisma.prisma;
  }

  return getRemotePrismaClient();
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getActivePrismaClient();
    const value = Reflect.get(client, property, receiver);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});

export default prisma;
