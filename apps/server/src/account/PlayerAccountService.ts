import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AVATAR_OPTIONS,
  type AvatarId,
  type BotPlayerIdentity,
  type CreateAccountResponse,
  type LeaderboardEntry,
  type MatchResult,
  type PlayerAccount,
  type RecoverAccountResponse,
} from '@gadha-chor/shared-types';
import { isValidDisplayName, isValidUsernameFormat } from '@gadha-chor/shared-utils';
import { InvalidCredentialError, ValidationError } from './accountErrors.js';
import type {
  PlayerAccountRecord,
  PlayerAccountRepository,
  ProfilePatch,
} from './PlayerAccountRepository.js';

const DEFAULT_LEADERBOARD_SIZE = 20;

// Crockford base32 — no I/L/O/U, so a handwritten transcription can't be confused between
// letters and digits. Encoding random bytes modulo 32 is unbiased because 256 is an exact
// multiple of 32.
const RECOVERY_TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_TOKEN_CHAR_COUNT = 16; // 16 * 5 bits = 80 bits of entropy
const RECOVERY_TOKEN_GROUP_SIZE = 4;
const RECOVERY_TOKEN_PREFIX = 'GC';

function generateRecoveryToken(): string {
  const bytes = randomBytes(RECOVERY_TOKEN_CHAR_COUNT);
  const chars = Array.from(
    bytes,
    (byte) => RECOVERY_TOKEN_ALPHABET[byte % RECOVERY_TOKEN_ALPHABET.length],
  ).join('');
  const groups: string[] = [];
  for (let start = 0; start < chars.length; start += RECOVERY_TOKEN_GROUP_SIZE) {
    groups.push(chars.slice(start, start + RECOVERY_TOKEN_GROUP_SIZE));
  }
  return `${RECOVERY_TOKEN_PREFIX}-${groups.join('-')}`;
}

// Accepts the token with or without its dashes/prefix casing so a slightly-mistyped-but-close
// transcription still normalizes to the same string this was hashed under at creation time.
function normalizeRecoveryToken(token: string): string {
  return token.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

// Both tokens are high-entropy random strings, not user-chosen passwords — a fast hash is the
// correct choice here (a slow KDF like bcrypt exists to blunt brute-forcing a low-entropy
// secret, which doesn't apply).
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toLeaderboardEntry(record: PlayerAccountRecord): LeaderboardEntry {
  return {
    playerId: record.playerId,
    displayName: record.displayName,
    avatar: record.avatar,
    gamesPlayed: record.gamesPlayed,
    wins: record.wins,
    losses: record.losses,
  };
}

function toPublicAccount(record: PlayerAccountRecord): PlayerAccount {
  return {
    playerId: record.playerId,
    username: record.username,
    displayName: record.displayName,
    avatar: record.avatar,
    gamesPlayed: record.gamesPlayed,
    wins: record.wins,
    losses: record.losses,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function assertValidUsername(username: string): void {
  if (!isValidUsernameFormat(username)) {
    throw new ValidationError(
      'Usernames must be 3-16 letters/numbers, no spaces or special characters.',
    );
  }
}

function assertValidDisplayName(displayName: string): void {
  if (!isValidDisplayName(displayName)) {
    throw new ValidationError('Display names must be 1-15 characters.');
  }
}

function assertValidAvatar(avatar: AvatarId): void {
  if (!(AVATAR_OPTIONS as readonly string[]).includes(avatar)) {
    throw new ValidationError('Unknown avatar.');
  }
}

export type CreateAccountInput = {
  readonly username: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
  readonly clientRequestId: string;
};

export type UpdateAccountInput = {
  readonly username?: string;
  readonly displayName?: string;
  readonly avatar?: AvatarId;
};

export class PlayerAccountService {
  constructor(private readonly repository: PlayerAccountRepository) {}

  async createAccount(input: CreateAccountInput): Promise<CreateAccountResponse> {
    assertValidUsername(input.username);
    assertValidDisplayName(input.displayName);
    assertValidAvatar(input.avatar);

    const deviceToken = generateDeviceToken();
    const recoveryToken = generateRecoveryToken();
    const record = await this.repository.create({
      playerId: randomUUID(),
      username: input.username,
      displayName: input.displayName.trim(),
      avatar: input.avatar,
      deviceTokenHash: hashToken(deviceToken),
      recoveryTokenHash: hashToken(normalizeRecoveryToken(recoveryToken)),
      clientRequestId: input.clientRequestId,
    });
    return { account: toPublicAccount(record), recoveryToken, deviceToken };
  }

  async getOwnAccount(deviceToken: string): Promise<PlayerAccount> {
    const record = await this.repository.findByDeviceTokenHash(hashToken(deviceToken));
    if (record === undefined) {
      throw new InvalidCredentialError();
    }
    return toPublicAccount(record);
  }

  async updateProfile(deviceToken: string, patch: UpdateAccountInput): Promise<PlayerAccount> {
    const owner = await this.repository.findByDeviceTokenHash(hashToken(deviceToken));
    if (owner === undefined) {
      throw new InvalidCredentialError();
    }
    if (patch.username !== undefined) {
      assertValidUsername(patch.username);
    }
    if (patch.displayName !== undefined) {
      assertValidDisplayName(patch.displayName);
    }
    if (patch.avatar !== undefined) {
      assertValidAvatar(patch.avatar);
    }
    const repositoryPatch: ProfilePatch = {
      ...(patch.username !== undefined ? { username: patch.username } : {}),
      ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    };
    const updated = await this.repository.updateProfile(owner.playerId, repositoryPatch);
    return toPublicAccount(updated);
  }

  async recoverAccount(recoveryToken: string): Promise<RecoverAccountResponse> {
    const normalized = normalizeRecoveryToken(recoveryToken);
    const record = await this.repository.findByRecoveryTokenHash(hashToken(normalized));
    if (record === undefined) {
      throw new InvalidCredentialError('That recovery token is not valid.');
    }
    const newDeviceToken = generateDeviceToken();
    const updated = await this.repository.rotateDeviceToken(
      record.playerId,
      hashToken(newDeviceToken),
    );
    return { account: toPublicAccount(updated), deviceToken: newDeviceToken };
  }

  async regenerateRecoveryToken(deviceToken: string): Promise<{ recoveryToken: string }> {
    const owner = await this.repository.findByDeviceTokenHash(hashToken(deviceToken));
    if (owner === undefined) {
      throw new InvalidCredentialError();
    }
    const recoveryToken = generateRecoveryToken();
    await this.repository.rotateRecoveryToken(
      owner.playerId,
      hashToken(normalizeRecoveryToken(recoveryToken)),
    );
    return { recoveryToken };
  }

  // Advisory only — the DB's unique index on lower(username) is the real guarantee, this just
  // gives the setup screen fast feedback while the user is typing.
  async isUsernameAvailable(username: string): Promise<boolean> {
    if (!isValidUsernameFormat(username)) {
      return false;
    }
    const existing = await this.repository.findByUsername(username);
    return existing === undefined;
  }

  // Bot accounts are real rows (is_bot: true), so they rank here exactly like real players —
  // no separate merge step needed.
  async getLeaderboard(limit = DEFAULT_LEADERBOARD_SIZE): Promise<readonly LeaderboardEntry[]> {
    const players = await this.repository.listTopPlayers(limit);
    return players.map(toLeaderboardEntry);
  }

  // Seats `count` bot accounts as opponents for a "Play with Bots" match — real, persisted
  // accounts, so their stats can update after the match exactly like a real player's (see
  // recordMatchResult).
  async listBotPlayers(count: number): Promise<readonly BotPlayerIdentity[]> {
    const bots = await this.repository.listBotAccounts(count);
    return bots.map((record) => ({
      playerId: record.playerId,
      displayName: record.displayName,
      avatar: record.avatar,
    }));
  }

  // Records the outcome of a match for the caller's own account, and — if any bot accounts
  // were seated in it — for those too. Only ever touches accounts truly flagged is_bot: true;
  // any id in botResults that doesn't resolve to one is silently ignored, so this endpoint can
  // never be used to tamper with another real player's stats no matter what a client sends.
  async recordMatchResult(
    deviceToken: string,
    ownResult: MatchResult,
    botResults: readonly { readonly playerId: string; readonly result: MatchResult }[] = [],
  ): Promise<void> {
    const owner = await this.repository.findByDeviceTokenHash(hashToken(deviceToken));
    if (owner === undefined) {
      throw new InvalidCredentialError();
    }
    await this.repository.incrementStats(owner.playerId, ownResult === 'WIN');
    for (const entry of botResults) {
      const candidate = await this.repository.findById(entry.playerId);
      if (candidate?.isBot === true) {
        await this.repository.incrementStats(candidate.playerId, entry.result === 'WIN');
      }
    }
  }
}
