import type { Card, Suit } from '../types/card.types.js';

export function hasSuit(hand: readonly Card[], suit: Suit): boolean {
  return hand.some((card) => card.suit === suit);
}

export function canPlayCard(
  hand: readonly Card[],
  card: Card,
  requiredSuit: Suit | undefined,
): boolean {
  if (!hand.some((handCard) => handCard.id === card.id)) {
    return false;
  }

  if (requiredSuit === undefined || card.suit === requiredSuit) {
    return true;
  }

  return !hasSuit(hand, requiredSuit);
}
