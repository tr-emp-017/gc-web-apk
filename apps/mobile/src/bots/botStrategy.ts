import { canPlayCard } from '@gadha-chor/game-engine';
import type { Card, Suit } from '@gadha-chor/game-engine';
import type { BotAction, BotView } from './types';

// A skill-independent base rate — see shouldRequestTransfer below for why it's inverted by
// skill rather than scaled up with it.
const REQUEST_TRANSFER_BASE_CHANCE = 0.12;

// Mirrors the engine's own legality exactly (canPlayCard, the ace-of-spades-only first move)
// instead of re-deriving the rule — a bot's choices can never diverge from what the engine
// would itself accept.
export function enumerateLegalCards(view: BotView): Card[] {
  if (view.firstMovePending) {
    return view.ownHand.filter((card) => card.suit === 'spades' && card.rank === 14);
  }
  return view.ownHand.filter((card) => canPlayCard(view.ownHand, card, view.requiredSuit));
}

function countBySuit(hand: readonly Card[]): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  for (const card of hand) {
    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  }
  return counts;
}

// Scores a candidate card — higher is better. There is no trump suit in this game, and
// winning a normal Chaal costs nothing (the cards are simply discarded), so the one real risk
// is being void of the led suit later and forcing an Inaam, which hands every card played so
// far in that Chaal to whoever currently holds the highest card of the led suit. A bot can
// never see other hands, so this plays it safe rather than trying to predict the future:
//   - Leading a fresh Chaal: prefer starting from the suit held fewest of (voids it soonest,
//     leaving more flexibility for the rest of the hand), then the lowest card in that suit.
//   - Following: prefer the lowest legal card of the required suit, to minimise the chance of
//     ending up holding the highest card of that suit if the Chaal gets interrupted.
// Isolated in its own function specifically so the heuristic can be tuned or replaced later
// without touching enumeration, randomness, or the transfer-request logic below.
export function scoreCard(view: BotView, card: Card): number {
  if (view.currentChaal.length === 0) {
    const suitCounts = countBySuit(view.ownHand);
    const suitCount = suitCounts.get(card.suit) ?? 0;
    return -suitCount * 100 - card.rank;
  }
  return -card.rank;
}

// "Request All Cards" grows the requester's OWN hand by the target's entire hand — a losing
// trade in a game about emptying your hand — so this models it as a rare mistake that gets
// LESS likely as skill goes up, rather than a deliberate strategy at any difficulty.
export function shouldRequestTransfer(
  view: BotView,
  skillPercent: number,
  random: () => number,
): string | null {
  if (view.currentChaal.length > 0 || view.firstMovePending) {
    return null;
  }
  const eligibleTargets = view.activePlayerIds.filter((id) => id !== view.botId);
  if (view.activePlayerIds.length < 3 || eligibleTargets.length === 0) {
    return null;
  }
  const mistakeChance = REQUEST_TRANSFER_BASE_CHANCE * (1 - skillPercent / 100);
  if (random() >= mistakeChance) {
    return null;
  }
  const targetIndex = Math.floor(random() * eligibleTargets.length);
  return eligibleTargets[targetIndex] ?? null;
}

// The bot's entry point: enumerates legal cards, scores each, then epsilon-greedy picks —
// with probability skillPercent/100 it takes the best-scored move, otherwise a uniformly
// random one among the rest. `random` defaults to Math.random but is injectable so behaviour
// stays controlled-random (never deterministic) while still being overridable if this is ever
// covered by tests. Even at 100% skill there's a residual chance of a non-optimal pick, on top
// of BotView's imperfect information, so bots are never unbeatable or perfectly optimal.
export function chooseBotAction(
  view: BotView,
  skillPercent: number,
  random: () => number = Math.random,
): BotAction {
  const transferTarget = shouldRequestTransfer(view, skillPercent, random);
  if (transferTarget !== null) {
    return { targetId: transferTarget, type: 'REQUEST_TRANSFER' };
  }

  const legalCards = enumerateLegalCards(view);
  const bestFirst = [...legalCards].sort((a, b) => scoreCard(view, b) - scoreCard(view, a));
  const best = bestFirst[0];
  if (best === undefined) {
    throw new Error('A bot has no legal card to play.');
  }
  if (bestFirst.length > 1 && random() >= skillPercent / 100) {
    const restIndex = 1 + Math.floor(random() * (bestFirst.length - 1));
    const fallback = bestFirst[restIndex] ?? best;
    return { cardId: fallback.id, type: 'PLAY_CARD' };
  }
  return { cardId: best.id, type: 'PLAY_CARD' };
}
