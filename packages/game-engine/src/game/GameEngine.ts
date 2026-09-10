import { createDeck } from '../deck/createDeck.js';
import { shuffleDeck } from '../deck/shuffleDeck.js';
import { canPlayCard, hasSuit } from '../rules/cardRules.js';
import { determineChaalWinner } from '../rules/chaalRules.js';
import { validateInaam } from '../rules/inaamRules.js';
import { MIN_PLAYERS, getActivePlayers } from '../rules/gameRules.js';
import { nextActivePlayerId } from '../turn/turnManager.js';
import type { Card } from '../types/card.types.js';
import type { GameState } from '../types/game.types.js';
import type { Player } from '../types/player.types.js';
import { assertGameIsPlayable } from './GameStateMachine.js';

export class GameEngine {
  private readonly state: GameState;

  private constructor(players: Player[]) {
    this.state = {
      status: 'LOBBY',
      players,
      currentChaal: [],
      discardPile: [],
      firstMovePending: false,
    };
  }

  static createGame(players: readonly Pick<Player, 'id' | 'name'>[]): GameEngine {
    if (players.length < MIN_PLAYERS) {
      throw new Error(`At least ${MIN_PLAYERS} players are required.`);
    }

    const ids = new Set<string>();
    const gamePlayers = players.map((player) => {
      if (ids.has(player.id)) {
        throw new Error(`Duplicate player id: ${player.id}`);
      }
      ids.add(player.id);

      return {
        id: player.id,
        name: player.name,
        hand: [],
        status: 'ACTIVE' as const,
      };
    });

    return new GameEngine(gamePlayers);
  }

  getState(): GameState {
    return {
      ...this.state,
      players: this.state.players.map((player) => ({ ...player, hand: [...player.hand] })),
      currentChaal: this.state.currentChaal.map((playedCard) => ({ ...playedCard })),
      discardPile: [...this.state.discardPile],
    };
  }

  startGame(deck: readonly Card[] = shuffleDeck(createDeck())): GameState {
    if (this.state.status !== 'LOBBY') {
      throw new Error('Game has already started.');
    }
    if (deck.length !== 52) {
      throw new Error('A standard 52-card deck is required.');
    }

    const seenCardIds = new Set<string>();
    for (const card of deck) {
      if (seenCardIds.has(card.id)) {
        throw new Error(`Duplicate card in deck: ${card.id}`);
      }
      seenCardIds.add(card.id);
    }

    this.state.players.forEach((player, index) => {
      player.hand = [];
      player.status = 'ACTIVE';
      for (let cardIndex = index; cardIndex < deck.length; cardIndex += this.state.players.length) {
        const card = deck[cardIndex];
        if (card !== undefined) {
          player.hand.push(card);
        }
      }
    });

    const aceOfSpades = deck.find((card) => card.suit === 'spades' && card.rank === 14);
    const startingPlayer = this.state.players.find((player) =>
      player.hand.some((card) => card.id === aceOfSpades?.id),
    );
    if (startingPlayer === undefined || aceOfSpades === undefined) {
      throw new Error('Deck must contain the ace of spades.');
    }

    this.state.status = 'PLAYING';
    this.state.chaalLeaderId = startingPlayer.id;
    this.state.currentPlayerId = startingPlayer.id;
    this.state.firstMovePending = true;
    return this.getState();
  }

  forceEndGame(gadhaChorId: string): GameState {
    if (!this.state.players.some((player) => player.id === gadhaChorId)) {
      throw new Error(`Unknown player: ${gadhaChorId}`);
    }
    this.state.status = 'GAME_OVER';
    this.state.gadhaChorId = gadhaChorId;
    this.state.currentPlayerId = undefined;
    this.state.chaalLeaderId = undefined;
    return this.getState();
  }

  playCard(playerId: string, cardId: string): GameState {
    assertGameIsPlayable(this.state);
    if (this.state.currentPlayerId !== playerId) {
      throw new Error("It is not this player's turn.");
    }

    const player = this.getPlayer(playerId);
    const card = player.hand.find((candidate) => candidate.id === cardId);
    if (card === undefined) {
      throw new Error('Player does not hold this card.');
    }

    if (this.state.firstMovePending && !(card.suit === 'spades' && card.rank === 14)) {
      throw new Error('The first card must be the ace of spades.');
    }

    if (!canPlayCard(player.hand, card, this.state.requiredSuit)) {
      throw new Error('Player must follow the required suit when possible.');
    }

    const isInaam =
      this.state.requiredSuit !== undefined &&
      !hasSuit(player.hand, this.state.requiredSuit) &&
      card.suit !== this.state.requiredSuit;

    player.hand = player.hand.filter((candidate) => candidate.id !== card.id);
    this.state.currentChaal.push({ playerId, card, isInaam });
    this.state.firstMovePending = false;
    this.state.requiredSuit ??= card.suit;

    if (isInaam) {
      this.handleInaam();
    } else if (this.hasCompletedChaal()) {
      this.handleSuccessfulChaal();
    } else {
      const nextPlayerId = nextActivePlayerId(this.state.players, playerId);
      if (nextPlayerId === undefined) {
        throw new Error('No active player is available for the next turn.');
      }
      this.state.currentPlayerId = nextPlayerId;
    }

    return this.getState();
  }

  // A player may, instead of leading a new chaal, ask another active player to hand over
  // their entire remaining hand. The target empties out (finishing/winning immediately,
  // same as playing their last card would), the requester's hand grows by that many cards,
  // and the requester's turn is spent — the next active player leads the following chaal.
  // Only allowed when leading (currentChaal empty) so it never leaves a chaal permanently
  // one contribution short of completing.
  transferHand(requesterId: string, targetId: string): GameState {
    assertGameIsPlayable(this.state);
    if (this.state.currentPlayerId !== requesterId) {
      throw new Error("It is not this player's turn.");
    }
    if (this.state.firstMovePending) {
      throw new Error('The first card must be the ace of spades.');
    }
    if (this.state.currentChaal.length > 0) {
      throw new Error('Cards can only be requested when leading a new chaal.');
    }
    if (requesterId === targetId) {
      throw new Error('Choose another player to request cards from.');
    }

    const requester = this.getPlayer(requesterId);
    const target = this.getPlayer(targetId);
    if (target.status !== 'ACTIVE') {
      throw new Error('That player is not active in this game.');
    }

    requester.hand.push(...target.hand);
    target.hand = [];
    this.finishPlayersWithNoCards();

    // The turn deliberately does not move: the requester was already leading a fresh
    // chaal and hasn't played a card, so nothing about whose turn it is has changed. They
    // simply now lead with a bigger hand.
    this.checkGameOver();
    return this.getState();
  }

  validateMove(playerId: string, cardId: string): boolean {
    try {
      assertGameIsPlayable(this.state);
      if (this.state.currentPlayerId !== playerId) {
        return false;
      }
      const player = this.getPlayer(playerId);
      const card = player.hand.find((candidate) => candidate.id === cardId);
      if (card === undefined) {
        return false;
      }
      if (this.state.firstMovePending) {
        return card.suit === 'spades' && card.rank === 14;
      }
      return canPlayCard(player.hand, card, this.state.requiredSuit);
    } catch {
      return false;
    }
  }

  validateInaam(playerId: string, cardId: string): boolean {
    if (this.state.status !== 'PLAYING' || this.state.currentPlayerId !== playerId) {
      return false;
    }
    const requiredSuit = this.state.requiredSuit;
    const player = this.getPlayer(playerId);
    const card = player.hand.find((candidate) => candidate.id === cardId);
    return requiredSuit !== undefined && card !== undefined
      ? validateInaam(player.hand, card, requiredSuit)
      : false;
  }

  private getPlayer(playerId: string): Player {
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    if (player === undefined) {
      throw new Error(`Unknown player: ${playerId}`);
    }
    return player;
  }

  private hasCompletedChaal(): boolean {
    return this.state.currentChaal.length === getActivePlayers(this.state.players).length;
  }

  private handleSuccessfulChaal(): void {
    const winnerId = determineChaalWinner(this.state.currentChaal);
    this.state.discardPile.push(...this.state.currentChaal.map((playedCard) => playedCard.card));
    this.state.currentChaal = [];
    this.state.requiredSuit = undefined;
    this.finishPlayersWithNoCards();

    if (this.checkGameOver()) {
      return;
    }

    const nextLeaderId = this.isActive(winnerId)
      ? winnerId
      : nextActivePlayerId(this.state.players, winnerId);
    if (nextLeaderId === undefined) {
      throw new Error('No active player can lead the next Chaal.');
    }
    this.state.chaalLeaderId = nextLeaderId;
    this.state.currentPlayerId = nextLeaderId;
  }

  private handleInaam(): void {
    // The Inaam always goes to whoever currently holds the highest card of the required suit
    // (not necessarily the Chaal leader) — every card played in this interrupted Chaal (including
    // the Inaam card itself) is collected by that player, and they also lead the next Chaal.
    const winnerId = determineChaalWinner(this.state.currentChaal);
    const winner = this.getPlayer(winnerId);
    winner.hand.push(...this.state.currentChaal.map((playedCard) => playedCard.card));
    this.state.currentChaal = [];
    this.state.requiredSuit = undefined;
    this.finishPlayersWithNoCards();

    if (this.checkGameOver()) {
      return;
    }

    this.state.chaalLeaderId = winnerId;
    this.state.currentPlayerId = winnerId;
  }

  private finishPlayersWithNoCards(): void {
    for (const player of this.state.players) {
      if (player.hand.length === 0) {
        player.status = 'FINISHED';
      }
    }
  }

  private checkGameOver(): boolean {
    const activePlayers = getActivePlayers(this.state.players);
    if (activePlayers.length !== 1) {
      return false;
    }

    const lastPlayer = activePlayers[0];
    if (lastPlayer === undefined) {
      return false;
    }

    this.state.status = 'GAME_OVER';
    this.state.gadhaChorId = lastPlayer.id;
    this.state.currentPlayerId = undefined;
    this.state.chaalLeaderId = undefined;
    return true;
  }

  private isActive(playerId: string): boolean {
    return this.getPlayer(playerId).status === 'ACTIVE';
  }
}
