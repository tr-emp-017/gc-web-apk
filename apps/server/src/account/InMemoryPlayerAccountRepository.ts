import { UsernameTakenError } from './accountErrors.js';
import type {
  NewPlayerAccountRecord,
  PlayerAccountRecord,
  PlayerAccountRepository,
  ProfilePatch,
} from './PlayerAccountRepository.js';

// In-process fake used by PlayerAccountService's test suite, mirroring InMemoryWalletLedger —
// enforces the same uniqueness/RETURNING semantics as the real Postgres implementation so
// service-level tests exercise real repository behavior, not a stub.
export class InMemoryPlayerAccountRepository implements PlayerAccountRepository {
  private readonly byId = new Map<string, PlayerAccountRecord>();
  private readonly byClientRequestId = new Map<string, string>();

  async create(record: NewPlayerAccountRecord): Promise<PlayerAccountRecord> {
    const existingRequestId = this.byClientRequestId.get(record.clientRequestId);
    if (existingRequestId !== undefined) {
      const existing = this.byId.get(existingRequestId);
      if (existing !== undefined) {
        return existing;
      }
    }
    if (this.findByUsernameSync(record.username) !== undefined) {
      throw new UsernameTakenError();
    }
    const now = new Date();
    const created: PlayerAccountRecord = {
      playerId: record.playerId,
      username: record.username,
      displayName: record.displayName,
      avatar: record.avatar,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      deviceTokenHash: record.deviceTokenHash,
      recoveryTokenHash: record.recoveryTokenHash,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(created.playerId, created);
    this.byClientRequestId.set(record.clientRequestId, created.playerId);
    return created;
  }

  async updateProfile(playerId: string, patch: ProfilePatch): Promise<PlayerAccountRecord> {
    const existing = this.byId.get(playerId);
    if (existing === undefined) {
      throw new Error('Account was not found.');
    }
    if (patch.username !== undefined) {
      const collision = this.findByUsernameSync(patch.username);
      if (collision !== undefined && collision.playerId !== playerId) {
        throw new UsernameTakenError();
      }
    }
    const updated: PlayerAccountRecord = {
      ...existing,
      username: patch.username ?? existing.username,
      displayName: patch.displayName ?? existing.displayName,
      avatar: patch.avatar ?? existing.avatar,
      updatedAt: new Date(),
    };
    this.byId.set(playerId, updated);
    return updated;
  }

  async findById(playerId: string): Promise<PlayerAccountRecord | undefined> {
    return this.byId.get(playerId);
  }

  async findByUsername(username: string): Promise<PlayerAccountRecord | undefined> {
    return this.findByUsernameSync(username);
  }

  async findByDeviceTokenHash(deviceTokenHash: string): Promise<PlayerAccountRecord | undefined> {
    return [...this.byId.values()].find((record) => record.deviceTokenHash === deviceTokenHash);
  }

  async findByRecoveryTokenHash(
    recoveryTokenHash: string,
  ): Promise<PlayerAccountRecord | undefined> {
    return [...this.byId.values()].find(
      (record) => record.recoveryTokenHash === recoveryTokenHash,
    );
  }

  async rotateDeviceToken(
    playerId: string,
    newDeviceTokenHash: string,
  ): Promise<PlayerAccountRecord> {
    const existing = this.byId.get(playerId);
    if (existing === undefined) {
      throw new Error('Account was not found.');
    }
    const updated: PlayerAccountRecord = {
      ...existing,
      deviceTokenHash: newDeviceTokenHash,
      updatedAt: new Date(),
    };
    this.byId.set(playerId, updated);
    return updated;
  }

  async rotateRecoveryToken(playerId: string, newRecoveryTokenHash: string): Promise<void> {
    const existing = this.byId.get(playerId);
    if (existing === undefined) {
      throw new Error('Account was not found.');
    }
    this.byId.set(playerId, {
      ...existing,
      recoveryTokenHash: newRecoveryTokenHash,
      updatedAt: new Date(),
    });
  }

  private findByUsernameSync(username: string): PlayerAccountRecord | undefined {
    const normalized = username.toLowerCase();
    return [...this.byId.values()].find((record) => record.username.toLowerCase() === normalized);
  }
}
