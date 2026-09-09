import type { GameState } from '../types/game.types.js';

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, hand: [...player.hand] })),
    currentChaal: state.currentChaal.map((playedCard) => ({ ...playedCard })),
    discardPile: [...state.discardPile],
  };
}
