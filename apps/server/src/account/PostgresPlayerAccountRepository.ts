import type { Pool } from 'pg';
import type { AvatarId } from '@gadha-chor/shared-types';
import { AccountNotFoundError, UsernameTakenError } from './accountErrors.js';
import type {
  NewPlayerAccountRecord,
  PlayerAccountRecord,
  PlayerAccountRepository,
  ProfilePatch,
} from './PlayerAccountRepository.js';

type PlayerRow = {
  readonly player_id: string;
  readonly username: string;
  readonly display_name: string;
  readonly avatar: string;
  readonly games_played: number;
  readonly wins: number;
  readonly losses: number;
  readonly device_token_hash: string;
  readonly recovery_token_hash: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

const UNIQUE_VIOLATION_CODE = '23505';

// Postgres reports which constraint was violated on the error object — this is how a single
// unique-violation catch tells "username already taken" apart from "this create was a retry of
// one that already succeeded" without any separate pre-check query (which would itself be
// racy). Never inspect this outside the Postgres-specific repository.
function violatedConstraint(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE &&
    'constraint' in error &&
    typeof (error as { constraint?: unknown }).constraint === 'string'
  ) {
    return (error as { constraint: string }).constraint;
  }
  return undefined;
}

function toRecord(row: PlayerRow): PlayerAccountRecord {
  return {
    playerId: row.player_id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar as AvatarId,
    gamesPlayed: row.games_played,
    wins: row.wins,
    losses: row.losses,
    deviceTokenHash: row.device_token_hash,
    recoveryTokenHash: row.recovery_token_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  'player_id, username, display_name, avatar, games_played, wins, losses, device_token_hash, recovery_token_hash, created_at, updated_at';

// Node-postgres (`pg`) talks the standard Postgres wire protocol — this same class works
// unmodified against Supabase, Render Postgres, or any other Postgres provider; only the
// DATABASE_URL env var changes. All Postgres-specific concerns (error codes, snake_case
// columns, Date<->ISO mapping) are isolated here — PlayerAccountService never sees any of it.
export class PostgresPlayerAccountRepository implements PlayerAccountRepository {
  constructor(private readonly pool: Pool) {}

  async create(record: NewPlayerAccountRecord): Promise<PlayerAccountRecord> {
    try {
      const result = await this.pool.query<PlayerRow>(
        `INSERT INTO players
           (player_id, username, display_name, avatar, device_token_hash, recovery_token_hash, client_request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${SELECT_COLUMNS}`,
        [
          record.playerId,
          record.username,
          record.displayName,
          record.avatar,
          record.deviceTokenHash,
          record.recoveryTokenHash,
          record.clientRequestId,
        ],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new Error('Failed to create account.');
      }
      return toRecord(row);
    } catch (error) {
      const constraint = violatedConstraint(error);
      if (constraint?.includes('client_request_id') === true) {
        const existing = await this.findByClientRequestId(record.clientRequestId);
        if (existing !== undefined) {
          return existing;
        }
      }
      if (constraint?.includes('username') === true) {
        throw new UsernameTakenError();
      }
      throw error;
    }
  }

  async updateProfile(playerId: string, patch: ProfilePatch): Promise<PlayerAccountRecord> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (patch.username !== undefined) {
      values.push(patch.username);
      setClauses.push(`username = $${values.length}`);
    }
    if (patch.displayName !== undefined) {
      values.push(patch.displayName);
      setClauses.push(`display_name = $${values.length}`);
    }
    if (patch.avatar !== undefined) {
      values.push(patch.avatar);
      setClauses.push(`avatar = $${values.length}`);
    }
    if (setClauses.length === 0) {
      const existing = await this.findById(playerId);
      if (existing === undefined) {
        throw new AccountNotFoundError();
      }
      return existing;
    }
    setClauses.push('updated_at = now()');
    values.push(playerId);
    try {
      const result = await this.pool.query<PlayerRow>(
        `UPDATE players SET ${setClauses.join(', ')}
         WHERE player_id = $${values.length}
         RETURNING ${SELECT_COLUMNS}`,
        values,
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new AccountNotFoundError();
      }
      return toRecord(row);
    } catch (error) {
      if (violatedConstraint(error)?.includes('username') === true) {
        throw new UsernameTakenError();
      }
      throw error;
    }
  }

  async findById(playerId: string): Promise<PlayerAccountRecord | undefined> {
    const result = await this.pool.query<PlayerRow>(
      `SELECT ${SELECT_COLUMNS} FROM players WHERE player_id = $1`,
      [playerId],
    );
    return this.firstRecord(result.rows);
  }

  async findByUsername(username: string): Promise<PlayerAccountRecord | undefined> {
    const result = await this.pool.query<PlayerRow>(
      `SELECT ${SELECT_COLUMNS} FROM players WHERE lower(username) = lower($1)`,
      [username],
    );
    return this.firstRecord(result.rows);
  }

  async findByDeviceTokenHash(deviceTokenHash: string): Promise<PlayerAccountRecord | undefined> {
    const result = await this.pool.query<PlayerRow>(
      `SELECT ${SELECT_COLUMNS} FROM players WHERE device_token_hash = $1`,
      [deviceTokenHash],
    );
    return this.firstRecord(result.rows);
  }

  async findByRecoveryTokenHash(
    recoveryTokenHash: string,
  ): Promise<PlayerAccountRecord | undefined> {
    const result = await this.pool.query<PlayerRow>(
      `SELECT ${SELECT_COLUMNS} FROM players WHERE recovery_token_hash = $1`,
      [recoveryTokenHash],
    );
    return this.firstRecord(result.rows);
  }

  async rotateDeviceToken(
    playerId: string,
    newDeviceTokenHash: string,
  ): Promise<PlayerAccountRecord> {
    const result = await this.pool.query<PlayerRow>(
      `UPDATE players SET device_token_hash = $1, updated_at = now()
       WHERE player_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [newDeviceTokenHash, playerId],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new AccountNotFoundError();
    }
    return toRecord(row);
  }

  async rotateRecoveryToken(playerId: string, newRecoveryTokenHash: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE players SET recovery_token_hash = $1, updated_at = now() WHERE player_id = $2`,
      [newRecoveryTokenHash, playerId],
    );
    if (result.rowCount === 0) {
      throw new AccountNotFoundError();
    }
  }

  private async findByClientRequestId(
    clientRequestId: string,
  ): Promise<PlayerAccountRecord | undefined> {
    const result = await this.pool.query<PlayerRow>(
      `SELECT ${SELECT_COLUMNS} FROM players WHERE client_request_id = $1`,
      [clientRequestId],
    );
    return this.firstRecord(result.rows);
  }

  private firstRecord(rows: readonly PlayerRow[]): PlayerAccountRecord | undefined {
    const row = rows[0];
    return row === undefined ? undefined : toRecord(row);
  }
}
