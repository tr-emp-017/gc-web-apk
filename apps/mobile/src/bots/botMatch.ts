import { GameEngine, determineChaalWinner } from '@gadha-chor/game-engine';
import type { GameState } from '@gadha-chor/game-engine';
import type { PublicGameState, PublicPlayer, VisibleCard } from '@gadha-chor/shared-types';
import { getBotDifficulty } from './difficulties';
import { chooseBotAction } from './botStrategy';
import type { BotDifficultyId, BotIdentity, BotView } from './types';

// Fixed synthetic id for the human seat — a bot match never touches the server, so there's no
// real session/UUID to hand out, same idea as previewFixtures.ts's PREVIEW_PLAYER_ID.
export const BOT_MATCH_HUMAN_ID = 'bot-match-human';

const MIN_THINK_DELAY_MS = 900;
const MAX_THINK_DELAY_MS = 2400;
const MIN_TRANSFER_RESPONSE_DELAY_MS = 1000;
const MAX_TRANSFER_RESPONSE_DELAY_MS = 1800;
// Accepting a transfer hands the accepting bot MORE cards for free — never a good idea in a
// hand-emptying game — so, like shouldRequestTransfer, this is a rare mistake that gets less
// likely as skill goes up rather than a real strategy at any difficulty.
const ACCEPT_TRANSFER_BASE_CHANCE = 0.1;

function randomDelayMs(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

type PlayedCardPair = { readonly playerId: string; readonly card: VisibleCard };

export type CompletedChaalEvent = {
  readonly winnerId: string;
  readonly cards: readonly PlayedCardPair[];
};

export type InaamEventPayload = {
  readonly giverId: string;
  readonly receiverId: string;
  readonly cards: readonly PlayedCardPair[];
};

export type TransferResolutionEvent = {
  readonly requesterId: string;
  readonly targetId: string;
  readonly accepted: boolean;
  readonly cardCount: number;
};

export type IncomingTransferRequestEvent = {
  readonly requesterId: string;
  readonly requesterName: string;
};

export type BotMatchHandlers = {
  readonly onGameState: (state: PublicGameState) => void;
  readonly onCompletedChaal: (event: CompletedChaalEvent) => void;
  readonly onInaam: (event: InaamEventPayload) => void;
  readonly onIncomingTransferRequest: (event: IncomingTransferRequestEvent) => void;
  readonly onTransferResolution: (event: TransferResolutionEvent) => void;
  // Fires exactly once, the moment the match reaches GAME_OVER — lets the caller report the
  // result (human + any real bot accounts seated) to the account API without re-deriving the
  // GAME_OVER transition itself from a stream of onGameState calls.
  readonly onGameOver: (gadhaChorId: string | undefined) => void;
};

type PendingTransfer = { readonly requesterId: string; readonly targetId: string };

// Local orchestrator for a solo-vs-bots match: wraps one in-process GameEngine (the exact same
// class RoomManager uses server-side) and mirrors the slice of RoomManager's own
// playCard/requestCardTransfer/respondCardTransfer logic needed to drive it — same engine
// calls, same event shapes, no wallet/session/socket concepts at all. This is what lets the
// existing game screen render a bot match with zero changes: it only ever sees the same
// PublicGameState/event shapes it already knows how to animate.
export class BotMatch {
  private readonly engine: GameEngine;
  private readonly humanId: string;
  private readonly difficulty: BotDifficultyId;
  private readonly handlers: BotMatchHandlers;
  private readonly identities: ReadonlyMap<string, BotIdentity>;
  private readonly botIds: ReadonlySet<string>;
  private pendingTransfer: PendingTransfer | null = null;
  private botTurnTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private gameOverReported = false;

  constructor(
    human: BotIdentity,
    bots: readonly BotIdentity[],
    difficulty: BotDifficultyId,
    handlers: BotMatchHandlers,
  ) {
    this.humanId = human.id;
    this.difficulty = difficulty;
    this.handlers = handlers;
    this.identities = new Map([human, ...bots].map((identity) => [identity.id, identity]));
    this.botIds = new Set(bots.map((bot) => bot.id));
    this.engine = GameEngine.createGame([human, ...bots].map(({ id, name }) => ({ id, name })));
    this.engine.startGame();
    this.scheduleBotTurnIfNeeded();
  }

  getPublicState(): PublicGameState {
    return this.buildPublicState();
  }

  playCard(cardId: string): void {
    this.applyPlayCard(this.humanId, cardId);
  }

  requestCardTransfer(targetId: string): void {
    this.applyRequestTransfer(this.humanId, targetId);
  }

  respondCardTransfer(accept: boolean): void {
    this.applyRespondTransfer(this.humanId, accept);
  }

  // Stops any pending bot-turn/transfer-response timer — called once the human leaves,
  // exits, or starts a fresh match, so a stale timer never fires into a torn-down match.
  destroy(): void {
    this.destroyed = true;
    if (this.botTurnTimer !== null) {
      clearTimeout(this.botTurnTimer);
      this.botTurnTimer = null;
    }
  }

  private isBot(playerId: string): boolean {
    return this.botIds.has(playerId);
  }

  private applyPlayCard(playerId: string, cardId: string): void {
    if (this.destroyed || this.pendingTransfer !== null) {
      return;
    }
    const previous = this.engine.getState();
    if (previous.currentPlayerId !== playerId) {
      return;
    }
    const previousPlayer = previous.players.find((player) => player.id === playerId);
    const finishingCard = previousPlayer?.hand.find((card) => card.id === cardId);
    const requiredSuit = previous.requiredSuit;
    const isInaam =
      requiredSuit !== undefined &&
      previousPlayer !== undefined &&
      !previousPlayer.hand.some((card) => card.suit === requiredSuit) &&
      previousPlayer.hand.some((card) => card.id === cardId && card.suit !== requiredSuit);

    let state: GameState;
    try {
      state = this.engine.playCard(playerId, cardId);
    } catch {
      // An illegal move slipping through here would be a bug elsewhere (the human's own hand
      // UI already only offers legal cards, and chooseBotAction only ever enumerates legal
      // ones) — fail safe rather than crash the app.
      return;
    }

    const chaalJustCompleted =
      !isInaam && previous.currentChaal.length > 0 && state.currentChaal.length === 0;

    if (isInaam && finishingCard !== undefined) {
      const cards = [
        ...previous.currentChaal.map((play) => ({ card: play.card, playerId: play.playerId })),
        { card: finishingCard, playerId },
      ];
      const receiverId = determineChaalWinner(
        cards.map((play) => ({ ...play, isInaam: play.playerId === playerId })),
      );
      this.handlers.onInaam({ cards, giverId: playerId, receiverId });
    } else if (
      chaalJustCompleted &&
      finishingCard !== undefined &&
      state.chaalLeaderId !== undefined
    ) {
      this.handlers.onCompletedChaal({
        cards: [
          ...previous.currentChaal.map((play) => ({ card: play.card, playerId: play.playerId })),
          { card: finishingCard, playerId },
        ],
        winnerId: state.chaalLeaderId,
      });
    }

    this.emitState();
    this.scheduleBotTurnIfNeeded();
  }

  private applyRequestTransfer(requesterId: string, targetId: string): void {
    if (this.destroyed || this.pendingTransfer !== null) {
      return;
    }
    const state = this.engine.getState();
    if (
      state.currentPlayerId !== requesterId ||
      state.firstMovePending ||
      state.currentChaal.length > 0 ||
      requesterId === targetId
    ) {
      return;
    }
    const activePlayerCount = state.players.filter((player) => player.status === 'ACTIVE').length;
    if (activePlayerCount < 3) {
      return;
    }
    const target = state.players.find((player) => player.id === targetId);
    if (target === undefined || target.status !== 'ACTIVE') {
      return;
    }

    this.pendingTransfer = { requesterId, targetId };
    if (targetId === this.humanId) {
      const requesterIdentity = this.identities.get(requesterId);
      this.handlers.onIncomingTransferRequest({
        requesterId,
        requesterName: requesterIdentity?.name ?? 'A player',
      });
      return;
    }
    // The target is a bot: it "decides" after a short delay, same as a human would need a
    // moment to read the prompt before tapping accept/decline.
    setTimeout(
      () => {
        if (this.destroyed) {
          return;
        }
        this.applyRespondTransfer(targetId, this.decideTransferResponse());
      },
      randomDelayMs(MIN_TRANSFER_RESPONSE_DELAY_MS, MAX_TRANSFER_RESPONSE_DELAY_MS),
    );
  }

  private applyRespondTransfer(targetId: string, accept: boolean): void {
    if (this.destroyed) {
      return;
    }
    const pending = this.pendingTransfer;
    if (pending === null || pending.targetId !== targetId) {
      return;
    }
    this.pendingTransfer = null;

    if (!accept) {
      this.handlers.onTransferResolution({
        accepted: false,
        cardCount: 0,
        requesterId: pending.requesterId,
        targetId,
      });
      // Nothing about the engine's state changed (a request never moves currentPlayerId), but
      // the requester still needs to take some OTHER action now — if they're a bot, their turn
      // must be explicitly re-scheduled here, since resolving a request doesn't fall through
      // to any other scheduling call the way playCard/an accepted transfer do.
      this.emitState();
      this.scheduleBotTurnIfNeeded();
      return;
    }

    const previous = this.engine.getState();
    const activePlayerCount = previous.players.filter(
      (player) => player.status === 'ACTIVE',
    ).length;
    if (activePlayerCount < 3) {
      this.handlers.onTransferResolution({
        accepted: false,
        cardCount: 0,
        requesterId: pending.requesterId,
        targetId,
      });
      this.emitState();
      this.scheduleBotTurnIfNeeded();
      return;
    }
    const cardCount = previous.players.find((player) => player.id === targetId)?.hand.length ?? 0;
    this.engine.transferHand(pending.requesterId, targetId);
    this.handlers.onTransferResolution({
      accepted: true,
      cardCount,
      requesterId: pending.requesterId,
      targetId,
    });
    this.emitState();
    this.scheduleBotTurnIfNeeded();
  }

  private decideTransferResponse(): boolean {
    const skillPercent = getBotDifficulty(this.difficulty).skillPercent;
    const mistakeChance = ACCEPT_TRANSFER_BASE_CHANCE * (1 - skillPercent / 100);
    return Math.random() < mistakeChance;
  }

  private scheduleBotTurnIfNeeded(): void {
    if (this.destroyed || this.pendingTransfer !== null) {
      return;
    }
    const state = this.engine.getState();
    if (state.status !== 'PLAYING' || state.currentPlayerId === undefined) {
      return;
    }
    if (!this.isBot(state.currentPlayerId)) {
      return;
    }
    const botId = state.currentPlayerId;
    this.botTurnTimer = setTimeout(
      () => {
        this.botTurnTimer = null;
        if (this.destroyed) {
          return;
        }
        this.runBotTurn(botId);
      },
      randomDelayMs(MIN_THINK_DELAY_MS, MAX_THINK_DELAY_MS),
    );
  }

  private runBotTurn(botId: string): void {
    const state = this.engine.getState();
    if (state.status !== 'PLAYING' || state.currentPlayerId !== botId) {
      return;
    }
    const view = this.buildBotView(botId);
    const skillPercent = getBotDifficulty(this.difficulty).skillPercent;
    const action = chooseBotAction(view, skillPercent);
    if (action.type === 'REQUEST_TRANSFER') {
      this.applyRequestTransfer(botId, action.targetId);
      return;
    }
    this.applyPlayCard(botId, action.cardId);
  }

  private buildBotView(botId: string): BotView {
    const state = this.engine.getState();
    const player = state.players.find((candidate) => candidate.id === botId);
    const activePlayers = state.players.filter((candidate) => candidate.status === 'ACTIVE');
    return {
      activePlayerIds: activePlayers.map((candidate) => candidate.id),
      botId,
      currentChaal: state.currentChaal,
      firstMovePending: state.firstMovePending,
      opponentCardCounts: new Map(
        state.players
          .filter((candidate) => candidate.id !== botId)
          .map((candidate) => [candidate.id, candidate.hand.length]),
      ),
      ownHand: player?.hand ?? [],
      requiredSuit: state.requiredSuit,
    };
  }

  private emitState(): void {
    const state = this.buildPublicState();
    this.handlers.onGameState(state);
    if (!this.gameOverReported && state.status === 'GAME_OVER') {
      this.gameOverReported = true;
      this.handlers.onGameOver(state.gadhaChorId);
    }
  }

  private buildPublicState(): PublicGameState {
    const state = this.engine.getState();
    const viewer = state.players.find((player) => player.id === this.humanId);
    return {
      chaalLeaderId: state.chaalLeaderId,
      currentChaal: state.currentChaal,
      currentPlayerId: state.currentPlayerId,
      firstMovePending: state.firstMovePending,
      gadhaChorId: state.gadhaChorId,
      ownCards: viewer?.hand ?? [],
      players: state.players.map((player) => this.buildPublicPlayer(player)),
      requiredSuit: state.requiredSuit,
      status: state.status,
    };
  }

  private buildPublicPlayer(player: GameState['players'][number]): PublicPlayer {
    const identity = this.identities.get(player.id);
    return {
      avatar: identity?.avatar ?? 'donkey',
      cardsRemaining: player.hand.length,
      connected: true,
      id: player.id,
      isHost: player.id === this.humanId,
      name: identity?.name ?? player.name,
      ready: true,
      status: player.status,
    };
  }
}

export function createBotMatch(
  human: BotIdentity,
  bots: readonly BotIdentity[],
  difficulty: BotDifficultyId,
  handlers: BotMatchHandlers,
): BotMatch {
  return new BotMatch(human, bots, difficulty, handlers);
}
