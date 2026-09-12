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

// A single ranked row — deliberately excludes username (not needed to display a ranking) so
// this never leaks anything beyond what every player's opponents already see in-game.
export type LeaderboardEntry = {
  readonly playerId: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
};

export type LeaderboardResponse = {
  readonly entries: readonly LeaderboardEntry[];
};

export type MatchResult = 'WIN' | 'LOSS';

// A bot opponent seated from a real, persisted account (see PlayerAccountService.listBotPlayers)
// rather than a made-up local name — its stats update after a match exactly like a real
// player's, so it behaves indistinguishably from one everywhere else in the system (the
// leaderboard, future matchmaking, etc).
export type BotPlayerIdentity = {
  readonly playerId: string;
  readonly displayName: string;
  readonly avatar: AvatarId;
};

export type BotPlayersResponse = {
  readonly bots: readonly BotPlayerIdentity[];
};

export type RecordMatchResultRequest = {
  // The caller's own result, attributed to whichever account the bearer device token belongs
  // to.
  readonly result: MatchResult;
  // Any bot accounts (from BotPlayerIdentity) that were also seated in this match — the server
  // only ever applies these to accounts actually flagged as bots, silently ignoring anything
  // else, so this can never be used to tamper with another real player's stats.
  readonly botResults?: readonly { readonly playerId: string; readonly result: MatchResult }[];
};
