import type { PlayedCard } from '../types/game.types.js';

export function determineChaalWinner(playedCards: readonly PlayedCard[]): string {
  const firstPlayedCard = playedCards[0];
  if (firstPlayedCard === undefined) {
    throw new Error('Cannot determine a winner for an empty Chaal.');
  }

  return playedCards.reduce((winner, playedCard) => {
    if (playedCard.card.suit !== firstPlayedCard.card.suit) {
      return winner;
    }

    return playedCard.card.rank > winner.card.rank ? playedCard : winner;
  }).playerId;
}
