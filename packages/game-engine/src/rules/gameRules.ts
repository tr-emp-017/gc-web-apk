import type { Player } from '../types/player.types.js';

export const MIN_PLAYERS = 3;

export function getActivePlayers(players: readonly Player[]): Player[] {
  return players.filter((player) => player.status === 'ACTIVE');
}
