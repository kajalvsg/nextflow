import { config } from "dotenv";
import { neonConfig, neon } from "@neondatabase/serverless";
import ws from "ws";

config({ path: ".env.local" });

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

const rows = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

console.log("Neon WebSocket connection OK. Tables:");
for (const row of rows) {
  console.log(" -", row.table_name);
}
