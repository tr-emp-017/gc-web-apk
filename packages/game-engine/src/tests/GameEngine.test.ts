import { describe, expect, it } from 'vitest';
import { createDeck } from '../deck/createDeck.js';
import { shuffleDeck } from '../deck/shuffleDeck.js';
import { GameEngine } from '../game/GameEngine.js';
import type { Card } from '../types/card.types.js';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
] as const;

function getCard(id: string): Card {
  const card = createDeck().find((candidate) => candidate.id === id);
  if (card === undefined) {
    throw new Error(`Missing test card: ${id}`);
  }
  return card;
}

function deckWithHands(hands: readonly (readonly string[])[]): Card[] {
  const deck = createDeck();
  const used = new Set<string>();
  const selectedHands = hands.map((hand) =>
    hand.map((id) => {
      if (used.has(id)) {
        throw new Error(`Duplicate test card: ${id}`);
      }
      used.add(id);
      return getCard(id);
    }),
  );
  const targets = [18, 17, 17] as const;

  for (let playerIndex = 0; playerIndex < selectedHands.length; playerIndex += 1) {
    const hand = selectedHands[playerIndex];
    const target = targets[playerIndex];
    if (hand === undefined || target === undefined) {
      throw new Error('Invalid test hand configuration.');
    }
    for (const card of deck) {
      if (hand.length >= target) {
        break;
      }
      if (!used.has(card.id)) {
        used.add(card.id);
        hand.push(card);
      }
    }
  }

  if (selectedHands.some((hand, index) => hand.length !== targets[index])) {
    throw new Error('Test hands could not be filled.');
  }

  const dealt: Card[] = [];
  for (let cardIndex = 0; cardIndex < targets[0]; cardIndex += 1) {
    for (const hand of selectedHands) {
      const card = hand[cardIndex];
      if (card !== undefined) {
        dealt.push(card);
      }
    }
  }
  return dealt;
}

describe('deck', () => {
  it('creates 52 unique cards with 13 cards per suit', () => {
    const deck = createDeck();
    const suits = new Map<string, number>();

    for (const card of deck) {
      suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
    }

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    expect([...suits.values()]).toEqual([13, 13, 13, 13]);
  });

  it('shuffles without changing the cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, () => 0.5);

    expect(shuffled.map((card) => card.id).sort()).toEqual(deck.map((card) => card.id).sort());
  });
});

describe('game start', () => {
  it('requires at least three players', () => {
    expect(() => GameEngine.createGame(players.slice(0, 2))).toThrow(/At least 3 players/);
  });

  it('starts with the player holding the ace of spades', () => {
    const engine = GameEngine.createGame(players);
    const state = engine.startGame(deckWithHands([['spades-14'], ['hearts-10'], ['clubs-2']]));

    expect(state.status).toBe('PLAYING');
    expect(state.currentPlayerId).toBe('a');
    expect(state.firstMovePending).toBe(true);
  });

  it('rejects a first card other than the ace of spades', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame(deckWithHands([['spades-14', 'hearts-2'], ['hearts-10'], ['clubs-2']]));

    expect(() => engine.playCard('a', 'hearts-2')).toThrow(/ace of spades/);
  });
});

describe('Chaal rules', () => {
  it('requires a player to follow suit when possible', () => {
    const engine = GameEngine.createGame(players);
    const state = engine.startGame(
      deckWithHands([['spades-14'], ['spades-10', 'hearts-4'], ['clubs-2']]),
    );

    engine.playCard('a', 'spades-14');
    expect(state.currentPlayerId).toBe('a');
    expect(engine.validateMove('b', 'hearts-4')).toBe(false);
    expect(() => engine.playCard('b', 'hearts-4')).toThrow(/follow the required suit/);
  });

  it('discards a successful Chaal and gives the highest card the next lead', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame(deckWithHands([['spades-14'], ['spades-10'], ['spades-13']]));

    engine.playCard('a', 'spades-14');
    engine.playCard('b', 'spades-10');
    const state = engine.playCard('c', 'spades-13');

    expect(state.currentChaal).toHaveLength(0);
    expect(state.discardPile.map((card) => card.id)).toEqual([
      'spades-14',
      'spades-10',
      'spades-13',
    ]);
    expect(state.chaalLeaderId).toBe('a');
    expect(state.currentPlayerId).toBe('a');
  });
});

describe('Inaam rules', () => {
  it('ends the Chaal immediately and returns the leader card plus Inaam card', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame(deckWithHands([['spades-14'], ['hearts-10'], ['clubs-2', 'spades-2']]));

    engine.playCard('a', 'spades-14');
    expect(engine.validateInaam('b', 'hearts-10')).toBe(true);
    const state = engine.playCard('b', 'hearts-10');

    const leader = state.players.find((player) => player.id === 'a');
    const giver = state.players.find((player) => player.id === 'b');
    expect(state.currentChaal).toHaveLength(0);
    expect(state.currentPlayerId).toBe('a');
    expect(leader?.hand.map((card) => card.id)).toContain('spades-14');
    expect(leader?.hand.map((card) => card.id)).toContain('hearts-10');
    expect(giver?.hand.map((card) => card.id)).not.toContain('hearts-10');
  });

  it('rejects Inaam when the player still has the required suit', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame(deckWithHands([['spades-14'], ['spades-10', 'hearts-4'], ['clubs-2']]));

    engine.playCard('a', 'spades-14');
    expect(engine.validateInaam('b', 'hearts-4')).toBe(false);
  });

  it('gives the Inaam to whoever holds the highest required-suit card, not just the Chaal leader', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame(
      deckWithHands([
        [
          'spades-14',
          'spades-13',
          'spades-12',
          'spades-11',
          'spades-10',
          'spades-9',
          'spades-8',
          'spades-7',
          'spades-6',
          'spades-5',
          'spades-4',
          'hearts-2',
          'hearts-4',
          'hearts-6',
          'hearts-8',
          'hearts-10',
          'hearts-12',
          'hearts-14',
        ],
        [
          'spades-3',
          'hearts-3',
          'hearts-5',
          'hearts-7',
          'hearts-9',
          'hearts-11',
          'hearts-13',
          'diamonds-2',
          'diamonds-3',
          'diamonds-4',
          'diamonds-5',
          'diamonds-6',
          'diamonds-7',
          'diamonds-8',
          'diamonds-9',
          'diamonds-10',
          'diamonds-11',
        ],
        [
          'spades-2',
          'diamonds-12',
          'diamonds-13',
          'diamonds-14',
          'clubs-2',
          'clubs-3',
          'clubs-4',
          'clubs-5',
          'clubs-6',
          'clubs-7',
          'clubs-8',
          'clubs-9',
          'clubs-10',
          'clubs-11',
          'clubs-12',
          'clubs-13',
          'clubs-14',
        ],
      ]),
    );

    // Chaal 1: 'a' leads with the forced ace of spades; 'b' and 'c' follow with lower spades, so
    // 'a' wins the Chaal outright and leads Chaal 2.
    engine.playCard('a', 'spades-14');
    engine.playCard('b', 'spades-3');
    const afterChaal1 = engine.playCard('c', 'spades-2');
    expect(afterChaal1.chaalLeaderId).toBe('a');

    // Chaal 2: 'a' (the leader) leads with a low heart; 'b' follows with a HIGHER heart; 'c' has
    // no hearts left and triggers an Inaam. The Inaam must go to 'b' (the highest heart so far),
    // not to 'a' just because 'a' led the Chaal — and 'b' collects every card played in this
    // Chaal (their own, 'a's, and the Inaam card), not just their own card plus the Inaam card.
    engine.playCard('a', 'hearts-2');
    engine.playCard('b', 'hearts-13');
    expect(engine.validateInaam('c', 'clubs-5')).toBe(true);
    const state = engine.playCard('c', 'clubs-5');

    const leader = state.players.find((player) => player.id === 'a');
    const winner = state.players.find((player) => player.id === 'b');
    expect(state.chaalLeaderId).toBe('b');
    expect(state.currentPlayerId).toBe('b');
    expect(winner?.hand.map((card) => card.id)).toContain('hearts-13');
    expect(winner?.hand.map((card) => card.id)).toContain('clubs-5');
    expect(winner?.hand.map((card) => card.id)).toContain('hearts-2');
    expect(leader?.hand.map((card) => card.id)).not.toContain('hearts-2');
    expect(state.discardPile.map((card) => card.id)).not.toContain('hearts-2');
  });
});

describe('finished players and game over', () => {
  it('skips finished players and eventually declares the last active player Gadha Chor', () => {
    const engine = GameEngine.createGame(players);
    let state = engine.startGame();
    const turnsTaken = new Set<string>();

    for (let turn = 0; state.status !== 'GAME_OVER' && turn < 500; turn += 1) {
      const currentPlayerId = state.currentPlayerId;
      if (currentPlayerId === undefined) {
        throw new Error('A playable game must have a current player.');
      }

      const player = state.players.find((candidate) => candidate.id === currentPlayerId);
      if (player === undefined || player.status !== 'ACTIVE') {
        throw new Error('Finished players must never receive a turn.');
      }
      turnsTaken.add(currentPlayerId);

      const playableCard = state.firstMovePending
        ? player.hand.find((card) => card.suit === 'spades' && card.rank === 14)
        : (player.hand.find(
            (card) => state.requiredSuit === undefined || card.suit === state.requiredSuit,
          ) ?? player.hand[0]);
      if (playableCard === undefined) {
        throw new Error('An active player must have a card to play.');
      }

      state = engine.playCard(currentPlayerId, playableCard.id);
    }

    expect(state.status).toBe('GAME_OVER');
    expect(state.gadhaChorId).toBeDefined();
    expect(turnsTaken).toEqual(new Set(['a', 'b', 'c']));
    expect(state.players.filter((player) => player.status === 'ACTIVE')).toHaveLength(1);
    expect(state.players.find((player) => player.id === state.gadhaChorId)?.hand).not.toHaveLength(
      0,
    );
  });
});

describe('forceEndGame', () => {
  it('immediately ends the game and names the given player as Gadha Chor', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame();

    const state = engine.forceEndGame('b');

    expect(state.status).toBe('GAME_OVER');
    expect(state.gadhaChorId).toBe('b');
    expect(state.currentPlayerId).toBeUndefined();
    expect(state.chaalLeaderId).toBeUndefined();
  });

  it('rejects an unknown player id', () => {
    const engine = GameEngine.createGame(players);
    engine.startGame();

    expect(() => engine.forceEndGame('nobody')).toThrow(/Unknown player/);
  });
});
