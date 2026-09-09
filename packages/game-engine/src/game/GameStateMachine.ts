import type { GameState } from '../types/game.types.js';

export function assertGameIsPlayable(state: GameState): void {
  if (state.status !== 'PLAYING') {
    throw new Error(`Game is not playable while in ${state.status} state.`);
  }
}
