import { getBotPlayers } from '../api/accountApi';
import type { BotIdentity } from './types';

const FETCH_TIMEOUT_MS = 3000;

export type ServerBotIdentities = {
  // Ready to hand straight to createBotMatch.
  readonly identities: readonly BotIdentity[];
  // The subset of `identities` (by id) that are real, persisted accounts — used afterward to
  // know which seats' results are worth reporting back to the server. Empty when the fetch
  // failed/timed out and the caller falls back to the local made-up pool instead.
  readonly serverBotIds: ReadonlySet<string>;
};

// Seats real, persisted bot accounts (so their stats evolve like a real player's) instead of
// the local made-up pool in botIdentities.ts — but bot mode was designed to work with zero
// server dependency, so a slow/unreachable server here must never block starting a match;
// it just falls back to the local pool (report the result). Returns `null` on any failure so
// the caller can fall back.
export async function fetchServerBotIdentities(count: number): Promise<ServerBotIdentities | null> {
  try {
    const bots = await Promise.race([
      getBotPlayers(count),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Bot roster fetch timed out.')), FETCH_TIMEOUT_MS);
      }),
    ]);
    if (bots.length < count) {
      // Fewer bot accounts than requested (e.g. the seed script hasn't been run) — fall back
      // entirely rather than mixing real and locally-made-up ids in one match.
      return null;
    }
    const identities = bots.map((bot) => ({
      avatar: bot.avatar,
      id: bot.playerId,
      name: bot.displayName,
    }));
    return { identities, serverBotIds: new Set(identities.map((identity) => identity.id)) };
  } catch {
    return null;
  }
}
