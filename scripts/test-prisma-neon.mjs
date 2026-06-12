import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const normalized = connectionString.includes("uselibpqcompat")
  ? connectionString
  : `${connectionString}${connectionString.includes("?") ? "&" : "?"}uselibpqcompat=true`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalized,
    connectionTimeoutMillis: 15_000,
  }),
});

try {
  const count = await prisma.workflow.count();
  console.log("Prisma + pg adapter OK. Workflow count:", count);
} catch (error) {
  console.error("Connection failed:", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
