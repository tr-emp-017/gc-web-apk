import type { Card } from './card.types.js';

export const PLAYER_STATUSES = ['ACTIVE', 'FINISHED'] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export type Player = {
  readonly id: string;
  readonly name: string;
  hand: Card[];
  status: PlayerStatus;
};
