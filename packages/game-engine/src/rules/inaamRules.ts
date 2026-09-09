import { hasSuit } from './cardRules.js';
import type { Card, Suit } from '../types/card.types.js';

export function validateInaam(hand: readonly Card[], card: Card, requiredSuit: Suit): boolean {
  return !hasSuit(hand, requiredSuit) && card.suit !== requiredSuit;
}
