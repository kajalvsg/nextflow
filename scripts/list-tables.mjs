import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30_000,
});

await client.connect();
const result = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`);
console.log("Tables in public schema:");
for (const row of result.rows) {
  console.log(" -", row.table_name);
}
await client.end();
