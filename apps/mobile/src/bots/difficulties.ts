import type { BotDifficulty, BotDifficultyId } from './types';

// The 4 fixed difficulty levels. skillPercent feeds botStrategy's epsilon-greedy card choice
// (see chooseBotAction) — it is a *chance of picking the best-scored move*, not a guarantee,
// so even "Higher Level" bots occasionally slip and are never unbeatable or deterministic.
export const BOT_DIFFICULTIES: readonly BotDifficulty[] = [
  { emoji: '🏆', id: 'higher', label: 'Higher Level', skillPercent: 100 },
  { emoji: '⭐', id: 'intermediate', label: 'Intermediate', skillPercent: 70 },
  { emoji: '🙂', id: 'medium', label: 'Medium', skillPercent: 50 },
  { emoji: '🐣', id: 'lower', label: 'Lower Level', skillPercent: 30 },
];

export function getBotDifficulty(id: BotDifficultyId): BotDifficulty {
  const difficulty = BOT_DIFFICULTIES.find((candidate) => candidate.id === id);
  if (difficulty === undefined) {
    throw new Error(`Unknown bot difficulty: ${id}`);
  }
  return difficulty;
}
