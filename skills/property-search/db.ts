// skills/property-search/db.ts
// Shared MySQL access layer: one connection pool + a safe, parameterized query helper.
import "dotenv/config";
import mysql from "mysql2/promise";

// A pool keeps a set of reusable connections instead of opening one per query.
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  socketPath: process.env.MYSQL_SOCKET,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Run a parameterized SQL statement. `params` safely fills the `?` placeholders,
// which is what prevents SQL injection. Returns the result rows.
export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}
