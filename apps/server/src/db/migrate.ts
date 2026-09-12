import type { Pool } from 'pg';

// Ordered, idempotent DDL statements run once at boot — deliberately not a full migration
// framework, since this is a single-table MVP; add new statements to the end of this array as
// the schema grows.
const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS players (
    player_id UUID PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    device_token_hash TEXT NOT NULL,
    recovery_token_hash TEXT NOT NULL,
    client_request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS players_username_lower_key ON players (lower(username))',
  'CREATE UNIQUE INDEX IF NOT EXISTS players_device_token_hash_key ON players (device_token_hash)',
  'CREATE UNIQUE INDEX IF NOT EXISTS players_recovery_token_hash_key ON players (recovery_token_hash)',
  `CREATE UNIQUE INDEX IF NOT EXISTS players_client_request_id_key
     ON players (client_request_id) WHERE client_request_id IS NOT NULL`,
];

// A migration failure must never prevent the server from starting — the rest of the game
// (rooms, bots, voice) works with zero database, and a Neon outage/misconfiguration shouldn't
// take multiplayer down with it. Account routes will simply 503 until the DB is reachable.
export async function migrate(pool: Pool): Promise<void> {
  for (const statement of STATEMENTS) {
    await pool.query(statement);
  }
}
