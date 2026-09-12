import type { AvatarId } from './socket.types.js';

// A permanent player account — created once on first app open, editable afterward. Deliberately
// scoped to identity + recovery only: gamesPlayed/wins/losses exist so future features have a
// place to write to, but nothing increments them yet.
export type PlayerAccount = {
  readonly playerId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateAccountRequest = {
  readonly username: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
  // Lets a retried create (e.g. after a cold-start timeout) return the caller's own
  // already-created account instead of failing on a username they already claimed.
  readonly clientRequestId: string;
};

export type CreateAccountResponse = {
  readonly account: PlayerAccount;
  // Shown to the user exactly once — the server never returns this again.
  readonly recoveryToken: string;
  readonly deviceToken: string;
};

export type UpdateAccountRequest = {
  readonly username?: string;
  readonly displayName?: string;
  readonly avatar?: AvatarId;
};

export type RecoverAccountRequest = {
  readonly recoveryToken: string;
};

export type RecoverAccountResponse = {
  readonly account: PlayerAccount;
  // A freshly minted device token for this (new) device — recovering rotates out whichever
  // device previously held one.
  readonly deviceToken: string;
};

export type RegenerateRecoveryTokenResponse = {
  readonly recoveryToken: string;
};

export type UsernameAvailabilityResponse = {
  readonly available: boolean;
};

export type AccountApiError = {
  readonly error: string;
};
