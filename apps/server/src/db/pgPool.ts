import { Pool } from 'pg';

// Standard node-postgres wire-protocol client — works unmodified against Neon, Supabase, or
// any other Postgres provider; swapping providers is only ever a DATABASE_URL change. Use
// Neon's *pooled* connection string here (the one with "-pooler" in the hostname) since this
// pool itself also holds a small number of persistent connections.
export function createPgPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 10_000,
  });
}
