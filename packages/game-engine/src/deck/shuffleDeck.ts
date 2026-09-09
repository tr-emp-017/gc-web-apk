import type { Card } from '../types/card.types.js';

export type RandomSource = () => number;

export function shuffleDeck(deck: readonly Card[], random: RandomSource = Math.random): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentCard = shuffled[index];
    const swapCard = shuffled[swapIndex];

    if (currentCard === undefined || swapCard === undefined) {
      throw new Error('Random source produced an invalid shuffle index.');
    }

    shuffled[index] = swapCard;
    shuffled[swapIndex] = currentCard;
  }

  return shuffled;
}
