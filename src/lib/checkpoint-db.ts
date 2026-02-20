import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
    pool = new Pool({
      connectionString: cleanUrl,
      max: 1,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function listThreadIds(): Promise<string[]> {
  const db = getPool();
  if (!db) return [];

  const { rows } = await db.query(
    "SELECT DISTINCT thread_id FROM checkpoints ORDER BY thread_id",
  );
  return rows.map((r) => r.thread_id as string);
}
