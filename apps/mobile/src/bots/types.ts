import type { GameState } from '@gadha-chor/game-engine';
import type { AvatarId } from '@gadha-chor/shared-types';

export const BOT_DIFFICULTY_IDS = ['higher', 'intermediate', 'medium', 'lower'] as const;
export type BotDifficultyId = (typeof BOT_DIFFICULTY_IDS)[number];

export type BotDifficulty = {
  readonly id: BotDifficultyId;
  readonly label: string;
  readonly emoji: string;
  readonly skillPercent: number;
};

export const BOT_PLAYER_COUNTS = [3, 4, 5, 6] as const;
export type BotPlayerCount = (typeof BOT_PLAYER_COUNTS)[number];

export type BotIdentity = {
  readonly id: string;
  readonly name: string;
  readonly avatar: AvatarId;
};

// What a bot is allowed to see when deciding its move: its own hand, plus only publicly
// knowable information about everyone else (how many cards they hold, never what they are).
// A bot is never handed the full, omniscient GameState — this is both what keeps it from
// "cheating" and what naturally caps how strong it can play, since even a top-difficulty bot
// never has hidden information to exploit.
export type BotView = {
  readonly botId: string;
  readonly ownHand: GameState['players'][number]['hand'];
  readonly opponentCardCounts: ReadonlyMap<string, number>;
  readonly currentChaal: GameState['currentChaal'];
  readonly requiredSuit: GameState['requiredSuit'];
  readonly firstMovePending: boolean;
  readonly activePlayerIds: readonly string[];
};

export type BotAction =
  | { readonly type: 'PLAY_CARD'; readonly cardId: string }
  | { readonly type: 'REQUEST_TRANSFER'; readonly targetId: string };
