import type { Card, Rank, Suit } from '../types/card.types.js';

export function cardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`;
}

export function compareCards(left: Card, right: Card): number {
  return left.rank - right.rank;
}

export function cardLabel(card: Card): string {
  const rankLabels: Record<Rank, string> = {
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A',
  };

  return `${rankLabels[card.rank]} of ${card.suit}`;
}
