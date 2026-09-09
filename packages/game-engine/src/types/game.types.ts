import type { Card, Suit } from './card.types.js';
import type { Player } from './player.types.js';

export const GAME_STATUSES = ['LOBBY', 'PLAYING', 'GAME_OVER'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export type PlayedCard = {
  readonly playerId: string;
  readonly card: Card;
  readonly isInaam: boolean;
};

export type GameState = {
  status: GameStatus;
  players: Player[];
  currentPlayerId?: string | undefined;
  chaalLeaderId?: string | undefined;
  requiredSuit?: Suit | undefined;
  currentChaal: PlayedCard[];
  discardPile: Card[];
  gadhaChorId?: string | undefined;
  firstMovePending: boolean;
};
