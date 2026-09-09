import type { Player } from '../types/player.types.js';

export function nextActivePlayerId(
  players: readonly Player[],
  currentPlayerId: string,
): string | undefined {
  const currentIndex = players.findIndex((player) => player.id === currentPlayerId);

  if (currentIndex < 0) {
    return undefined;
  }

  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (candidate?.status === 'ACTIVE') {
      return candidate.id;
    }
  }

  return undefined;
}
