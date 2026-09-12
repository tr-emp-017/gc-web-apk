import type { AvatarId } from '@gadha-chor/shared-types';

// The persisted shape of an account, as the repository layer sees it — camelCase, Date
// objects, hashes rather than plaintext secrets. PlayerAccountService maps this to the public
// `PlayerAccount` shape (from shared-types) that ever leaves the server.
export type PlayerAccountRecord = {
  readonly playerId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly deviceTokenHash: string;
  readonly recoveryTokenHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type NewPlayerAccountRecord = {
  readonly playerId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
  readonly deviceTokenHash: string;
  readonly recoveryTokenHash: string;
  readonly clientRequestId: string;
};

export type ProfilePatch = {
  readonly username?: string;
  readonly displayName?: string;
  readonly avatar?: AvatarId;
};

// Narrow, intention-revealing methods rather than generic CRUD — keeps the "no stats writes
// yet" boundary structurally enforced (there is no `update(playerId, {gamesPlayed})`), and
// keeps every Postgres-specific concern (unique-violation codes, row mapping, snake_case) fully
// inside PostgresPlayerAccountRepository so PlayerAccountService never depends on the database
// technology underneath it.
export interface PlayerAccountRepository {
  // Throws UsernameTakenError on a username collision, or resolves the existing account for a
  // retried create sharing the same clientRequestId (Render/Neon cold-start retry safety).
  create(record: NewPlayerAccountRecord): Promise<PlayerAccountRecord>;

  // A single UPDATE ... RETURNING under the hood — never read-modify-write. Throws
  // UsernameTakenError on a username collision with a different account.
  updateProfile(playerId: string, patch: ProfilePatch): Promise<PlayerAccountRecord>;

  findById(playerId: string): Promise<PlayerAccountRecord | undefined>;
  findByUsername(username: string): Promise<PlayerAccountRecord | undefined>;
  findByDeviceTokenHash(deviceTokenHash: string): Promise<PlayerAccountRecord | undefined>;
  findByRecoveryTokenHash(recoveryTokenHash: string): Promise<PlayerAccountRecord | undefined>;

  rotateDeviceToken(playerId: string, newDeviceTokenHash: string): Promise<PlayerAccountRecord>;
  rotateRecoveryToken(playerId: string, newRecoveryTokenHash: string): Promise<void>;
}
