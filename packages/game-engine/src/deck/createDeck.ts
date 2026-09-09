import { cardId } from '../utils/cardUtils.js';
import { RANKS, SUITS, type Card } from '../types/card.types.js';

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: cardId(suit, rank),
      suit,
      rank,
    })),
  );
}
