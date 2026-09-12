import type {
  AvatarId,
  PublicGameState,
  PublicPlayer,
  RoomListing,
  RoomSummary,
  VisibleCard,
} from '@gadha-chor/shared-types';
import { randomInt, randomUUID } from 'node:crypto';

import { GameEngine, determineChaalWinner } from '@gadha-chor/game-engine';
import type { WalletLedger } from '../wallet/WalletLedger.js';
import { InMemoryWalletLedger } from '../wallet/InMemoryWalletLedger.js';
import { calculateWinnerReward } from '../wallet/reward.js';

type RoomPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatar: AvatarId;
  ready: boolean;
  connected: boolean;
  socketId?: string;
  postGameChoice?: 'LEFT' | 'SPECTATING';
};

type Room = {
  readonly code: string;
  hostPlayerId: string;
  readonly players: Map<string, RoomPlayer>;
  game?: GameEngine;
  reconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  entryPoints: number;
  pool?: number;
  startedPlayerCount?: number;
  showCardCounts: boolean;
  isPublic: boolean;
  // Only ever set on a room created via quickMatch — the exact headcount it auto-starts at,
  // bypassing the host/ready gate that startGame otherwise enforces. Undefined for every
  // manually-created room (createRoom), regardless of its isPublic value.
  targetPlayerCount?: number;
  pendingTransferRequest?: { readonly requesterId: string; readonly targetId: string };
};

export type RoomPlayerSnapshot = RoomPlayer & { readonly isHost: boolean };

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly reconnectWindowMs: number;
  private readonly walletLedger: WalletLedger;

  constructor(reconnectWindowMs = 60_000, walletLedger: WalletLedger = new InMemoryWalletLedger()) {
    this.reconnectWindowMs = reconnectWindowMs;
    this.walletLedger = walletLedger;
  }

  createRoom(
    name: string,
    avatar: AvatarId,
    socketId: string,
    entryPoints: number,
    showCardCounts = false,
    isPublic = false,
  ): { code: string; playerId: string; walletBalance: number } {
    if (!Number.isInteger(entryPoints) || entryPoints <= 0) {
      throw new Error('Entry points must be a positive number.');
    }
    const code = this.createRoomCode();
    const playerId = randomUUID();
    const walletBalance = this.walletLedger.getBalance(playerId);
    if (walletBalance < entryPoints) {
      throw new Error('Insufficient balance to create this room.');
    }
    const player: RoomPlayer = {
      id: playerId,
      name: this.cleanName(name),
      avatar,
      ready: true,
      connected: true,
      socketId,
    };
    this.rooms.set(code, {
      code,
      hostPlayerId: playerId,
      players: new Map([[playerId, player]]),
      reconnectTimers: new Map(),
      entryPoints,
      showCardCounts,
      isPublic,
    });
    return { code, playerId, walletBalance };
  }

  joinRoom(
    code: string,
    name: string,
    avatar: AvatarId,
    socketId: string,
  ): { code: string; playerId: string; walletBalance: number } {
    const room = this.getRoom(code);
    if (room.game !== undefined) {
      throw new Error('Game has already started.');
    }
    if (room.players.size >= 6) {
      throw new Error('Room is full.');
    }

    const playerId = randomUUID();
    const walletBalance = this.walletLedger.getBalance(playerId);
    if (walletBalance < room.entryPoints) {
      throw new Error('Insufficient balance to join this room.');
    }
    room.players.set(playerId, {
      id: playerId,
      name: this.cleanName(name),
      avatar,
      ready: false,
      connected: true,
      socketId,
    });
    return { code: room.code, playerId, walletBalance };
  }

  reconnect(code: string, playerId: string, socketId: string): Room {
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    if (player === undefined) {
      throw new Error('Player session was not found.');
    }
    const timer = room.reconnectTimers.get(playerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      room.reconnectTimers.delete(playerId);
    }
    player.connected = true;
    player.socketId = socketId;
    return room;
  }

  disconnect(code: string, playerId: string, onExpired: () => void): void {
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    if (player === undefined) {
      return;
    }
    player.connected = false;
    delete player.socketId;
    this.clearPendingTransferIfInvolves(room, playerId);
    const timer = setTimeout(() => {
      room.reconnectTimers.delete(playerId);
      if (!player.connected) {
        room.players.delete(playerId);
        if (room.players.size === 0) {
          this.rooms.delete(room.code);
        }
        onExpired();
      }
    }, this.reconnectWindowMs);
    room.reconnectTimers.set(playerId, timer);
  }

  leave(code: string, playerId: string): void {
    const room = this.getRoom(code);
    const timer = room.reconnectTimers.get(playerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      room.reconnectTimers.delete(playerId);
    }
    room.players.delete(playerId);
    if (room.players.size === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostPlayerId === playerId) {
      const [nextHostId] = room.players.keys();
      room.hostPlayerId = nextHostId as string;
      const nextHost = room.players.get(room.hostPlayerId);
      if (nextHost !== undefined) {
        nextHost.ready = true;
      }
    }
  }

  setReady(code: string, playerId: string, ready: boolean): void {
    const room = this.getRoom(code);
    const player = this.getPlayerFromRoom(room, playerId);
    player.ready = room.hostPlayerId === playerId ? true : ready;
  }

  // Resets a finished match back to a lobby-ready state for the same room/players — anyone
  // still in the room can trigger this, since it doesn't itself move any money (entry points
  // are only deducted again once the host presses startGame, same as the very first game).
  // publicRoom's status is derived from room.game (undefined => 'LOBBY'), so clearing it here
  // is what actually moves the room back to the lobby for every client.
  playAgain(code: string, playerId: string): void {
    const room = this.getRoom(code);
    this.getPlayerFromRoom(room, playerId);
    if (room.game === undefined || room.game.getState().status !== 'GAME_OVER') {
      throw new Error('The current match has not finished yet.');
    }
    delete room.game;
    delete room.pool;
    delete room.startedPlayerCount;
    delete room.pendingTransferRequest;
    for (const roomPlayer of room.players.values()) {
      roomPlayer.ready = room.hostPlayerId === roomPlayer.id;
      delete roomPlayer.postGameChoice;
    }
  }

  startGame(
    code: string,
    playerId: string,
  ): { state: PublicGameState; balances: readonly { playerId: string; balance: number }[] } {
    const room = this.getRoom(code);
    if (room.hostPlayerId !== playerId) {
      throw new Error('Only the host can start the game.');
    }
    if (room.players.size < 3) {
      throw new Error('At least 3 players are required.');
    }
    if ([...room.players.values()].some((player) => !player.ready)) {
      throw new Error('All players must be ready.');
    }
    return this.beginMatch(room, playerId);
  }

  // The economics/engine-creation core shared by a host-triggered startGame and quickMatch's
  // auto-start-on-full path — every caller has already decided the room is allowed to begin;
  // this just makes it happen and reports the resulting state/balances.
  private beginMatch(
    room: Room,
    viewerId: string,
  ): { state: PublicGameState; balances: readonly { playerId: string; balance: number }[] } {
    const players = [...room.players.values()];
    if (players.some((player) => this.walletLedger.getBalance(player.id) < room.entryPoints)) {
      throw new Error('A player no longer has enough balance for the entry points.');
    }
    for (const player of players) {
      this.walletLedger.debit(player.id, room.entryPoints);
    }
    room.startedPlayerCount = players.length;
    room.pool = room.entryPoints * players.length;

    room.game = GameEngine.createGame(players.map(({ id, name }) => ({ id, name })));
    room.game.startGame();
    return {
      state: this.publicGameState(room, viewerId),
      balances: players.map((player) => ({
        playerId: player.id,
        balance: this.walletLedger.getBalance(player.id),
      })),
    };
  }

  // "Play a Match" → real players: joins an open public room targeting the same playerCount if
  // one exists (never creating a redundant second one), otherwise creates a fresh public room
  // with that target. Every joiner is marked ready immediately — there's no manual ready-up in
  // this mode — and the instant the room reaches its target headcount, the match auto-starts
  // with no host action at all.
  quickMatch(
    name: string,
    avatar: AvatarId,
    playerCount: number,
    socketId: string,
    entryPoints: number,
    showCardCounts = false,
  ): {
    code: string;
    playerId: string;
    walletBalance: number;
    started?: {
      state: PublicGameState;
      balances: readonly { playerId: string; balance: number }[];
    };
  } {
    if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 6) {
      throw new Error('Player count must be between 3 and 6.');
    }
    const existing = [...this.rooms.values()].find(
      (candidate) =>
        candidate.isPublic &&
        candidate.game === undefined &&
        candidate.targetPlayerCount === playerCount &&
        candidate.players.size < playerCount,
    );

    let room: Room;
    let playerId: string;
    let walletBalance: number;
    if (existing !== undefined) {
      room = existing;
      playerId = randomUUID();
      walletBalance = this.walletLedger.getBalance(playerId);
      if (walletBalance < room.entryPoints) {
        throw new Error('Insufficient balance to join this room.');
      }
      room.players.set(playerId, {
        id: playerId,
        name: this.cleanName(name),
        avatar,
        ready: true,
        connected: true,
        socketId,
      });
    } else {
      const created = this.createRoom(name, avatar, socketId, entryPoints, showCardCounts, true);
      room = this.getRoom(created.code);
      room.targetPlayerCount = playerCount;
      playerId = created.playerId;
      walletBalance = created.walletBalance;
    }

    if (room.players.size === room.targetPlayerCount) {
      try {
        const started = this.beginMatch(room, playerId);
        return { code: room.code, playerId, walletBalance, started };
      } catch {
        // The balance recheck inside beginMatch should never actually fail here — every
        // joiner's balance was just checked synchronously above, and nothing else can run
        // in between in this single-threaded, fully-synchronous manager — but if it somehow
        // does, leave the room in LOBBY rather than lose the player's successful join.
      }
    }
    return { code: room.code, playerId, walletBalance };
  }

  // A one-shot snapshot for the Rooms browser — every currently open (not yet started) room,
  // public and private. A private room's code is never included; that omission is the entire
  // privacy boundary (see RoomListing's own comment in shared-types).
  listRooms(): readonly RoomListing[] {
    const listings: RoomListing[] = [];
    for (const room of this.rooms.values()) {
      if (room.game !== undefined) {
        continue;
      }
      const host = room.players.get(room.hostPlayerId);
      if (host === undefined) {
        continue;
      }
      listings.push({
        isPublic: room.isPublic,
        code: room.isPublic ? room.code : undefined,
        hostName: host.name,
        hostAvatar: host.avatar,
        playerCount: room.players.size,
        targetPlayerCount: room.targetPlayerCount,
      });
    }
    return listings;
  }

  playCard(
    code: string,
    playerId: string,
    cardId: string,
  ): {
    state: PublicGameState;
    isInaam: boolean;
    chaalWinnerId?: string | undefined;
    completedChaal?:
      readonly { readonly playerId: string; readonly card: VisibleCard }[] | undefined;
    inaamReceiverId?: string | undefined;
    inaamCards?: readonly { readonly playerId: string; readonly card: VisibleCard }[] | undefined;
    leaderId?: string | undefined;
    finishedPlayerIds: string[];
    rewards: Record<string, number>;
  } {
    const room = this.getRoom(code);
    if (room.game === undefined) {
      throw new Error('Game has not started.');
    }
    if (room.pendingTransferRequest !== undefined) {
      throw new Error('A card transfer request is pending.');
    }
    const previous = room.game.getState();
    const previousPlayer = previous.players.find((player) => player.id === playerId);
    const requiredSuit = previous.requiredSuit;
    const isInaam =
      requiredSuit !== undefined &&
      previousPlayer !== undefined &&
      !previousPlayer.hand.some((card) => card.suit === requiredSuit) &&
      previousPlayer.hand.some((card) => card.id === cardId && card.suit !== requiredSuit);
    const finishingCard = previousPlayer?.hand.find((card) => card.id === cardId);
    const state = room.game.playCard(playerId, cardId);
    const finishedPlayerIds = state.players
      .filter((player) => player.status === 'FINISHED')
      .filter(
        (player) =>
          previous.players.find((oldPlayer) => oldPlayer.id === player.id)?.status !== 'FINISHED',
      )
      .map((player) => player.id);
    const rewards: Record<string, number> = {};
    if (
      finishedPlayerIds.length > 0 &&
      room.pool !== undefined &&
      room.startedPlayerCount !== undefined
    ) {
      const reward = calculateWinnerReward(room.pool, room.startedPlayerCount);
      for (const finishedPlayerId of finishedPlayerIds) {
        this.walletLedger.credit(finishedPlayerId, reward);
        rewards[finishedPlayerId] = reward;
      }
    }
    const chaalJustCompleted =
      !isInaam && previous.currentChaal.length > 0 && state.currentChaal.length === 0;
    // Computed independently from determineChaalWinner (the same rule GameEngine applies
    // internally) rather than read off state.chaalLeaderId afterward — an Inaam that also
    // ends the game wipes chaalLeaderId, but the receiver still needs to be reported so the
    // client can animate the cards to the right seat.
    const inaamCards =
      isInaam && finishingCard !== undefined
        ? [
            ...previous.currentChaal.map((play) => ({ playerId: play.playerId, card: play.card })),
            { playerId, card: finishingCard },
          ]
        : undefined;
    const inaamReceiverId =
      inaamCards !== undefined
        ? determineChaalWinner(
            inaamCards.map((play) => ({ ...play, isInaam: play.playerId === playerId })),
          )
        : undefined;
    return {
      state: this.publicGameState(room, playerId),
      isInaam,
      chaalWinnerId: chaalJustCompleted ? state.chaalLeaderId : undefined,
      completedChaal:
        chaalJustCompleted && finishingCard !== undefined
          ? [
              ...previous.currentChaal.map((play) => ({
                playerId: play.playerId,
                card: play.card,
              })),
              { playerId, card: finishingCard },
            ]
          : undefined,
      inaamReceiverId,
      inaamCards,
      leaderId: previous.chaalLeaderId,
      finishedPlayerIds,
      rewards,
    };
  }

  // Asking someone to hand over their whole hand needs their sign-off — this just records
  // the request and hands back their socket id so the caller can notify them; the actual
  // hand transfer only happens once they call respondCardTransfer with accept=true.
  requestCardTransfer(
    code: string,
    requesterId: string,
    targetId: string,
  ): { targetSocketId?: string | undefined } {
    const room = this.getRoom(code);
    if (room.game === undefined) {
      throw new Error('Game has not started.');
    }
    if (room.pendingTransferRequest !== undefined) {
      throw new Error('A card transfer request is already pending.');
    }
    const state = room.game.getState();
    if (state.currentPlayerId !== requesterId) {
      throw new Error("It is not this player's turn.");
    }
    if (state.firstMovePending) {
      throw new Error('The first card must be the ace of spades.');
    }
    if (state.currentChaal.length > 0) {
      throw new Error('Cards can only be requested when leading a new chaal.');
    }
    if (requesterId === targetId) {
      throw new Error('Choose another player to request cards from.');
    }
    // With only 2 active players left, this would let the requester force an instant,
    // one-sided finish (the target wins by emptying their hand, but the requester is then
    // the sole active player and immediately becomes Gadha Chor) — skipping any real play.
    // Re-validated here (not just hidden in the UI) since a client can't be trusted to
    // enforce this on its own.
    const activePlayerCount = state.players.filter((player) => player.status === 'ACTIVE').length;
    if (activePlayerCount < 3) {
      throw new Error('At least 3 active players are required to request someone’s cards.');
    }
    const target = this.getPlayerFromRoom(room, targetId);
    const targetGamePlayer = state.players.find((player) => player.id === targetId);
    if (targetGamePlayer?.status !== 'ACTIVE') {
      throw new Error('That player is not active in this game.');
    }
    room.pendingTransferRequest = { requesterId, targetId };
    return { targetSocketId: target.socketId };
  }

  respondCardTransfer(
    code: string,
    targetId: string,
    accept: boolean,
  ): {
    requesterId: string;
    accepted: boolean;
    cardCount: number;
    finishedPlayerIds: string[];
    rewards: Record<string, number>;
  } {
    const room = this.getRoom(code);
    const pending = room.pendingTransferRequest;
    if (pending === undefined || pending.targetId !== targetId) {
      throw new Error('There is no pending card transfer request for you to respond to.');
    }
    delete room.pendingTransferRequest;
    if (!accept) {
      return {
        accepted: false,
        cardCount: 0,
        finishedPlayerIds: [],
        requesterId: pending.requesterId,
        rewards: {},
      };
    }
    if (room.game === undefined) {
      throw new Error('Game has not started.');
    }
    const previous = room.game.getState();
    // Re-checked here too (not just at request time) — a third, unrelated player could have
    // left in between, and this is the last point before the hand actually moves.
    const activePlayerCount = previous.players.filter(
      (player) => player.status === 'ACTIVE',
    ).length;
    if (activePlayerCount < 3) {
      throw new Error('At least 3 active players are required to complete this transfer.');
    }
    const cardCount =
      previous.players.find((player) => player.id === pending.targetId)?.hand.length ?? 0;
    const state = room.game.transferHand(pending.requesterId, pending.targetId);
    const finishedPlayerIds = state.players
      .filter((player) => player.status === 'FINISHED')
      .filter(
        (player) =>
          previous.players.find((oldPlayer) => oldPlayer.id === player.id)?.status !== 'FINISHED',
      )
      .map((player) => player.id);
    const rewards: Record<string, number> = {};
    if (
      finishedPlayerIds.length > 0 &&
      room.pool !== undefined &&
      room.startedPlayerCount !== undefined
    ) {
      const reward = calculateWinnerReward(room.pool, room.startedPlayerCount);
      for (const finishedPlayerId of finishedPlayerIds) {
        this.walletLedger.credit(finishedPlayerId, reward);
        rewards[finishedPlayerId] = reward;
      }
    }
    return {
      accepted: true,
      cardCount,
      finishedPlayerIds,
      requesterId: pending.requesterId,
      rewards,
    };
  }

  getRoom(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (room === undefined) {
      throw new Error('Room was not found.');
    }
    return room;
  }

  getRoomSummary(code: string): RoomSummary {
    const room = this.getRoom(code);
    return {
      code: room.code,
      hostPlayerId: room.hostPlayerId,
      status: room.game?.getState().status ?? 'LOBBY',
      players: [...room.players.values()].map((player) => this.publicPlayer(room, player)),
      entryPoints: room.entryPoints,
      pool: room.pool,
      showCardCounts: room.showCardCounts,
      isPublic: room.isPublic,
      targetPlayerCount: room.targetPlayerCount,
    };
  }

  kickPlayer(
    code: string,
    hostPlayerId: string,
    targetPlayerId: string,
  ): { socketId?: string | undefined } {
    const room = this.getRoom(code);
    if (room.hostPlayerId !== hostPlayerId) {
      throw new Error('Only the host can remove players.');
    }
    if (room.game !== undefined) {
      throw new Error('Cannot remove a player after the game has started.');
    }
    if (targetPlayerId === hostPlayerId) {
      throw new Error('The host cannot remove themself.');
    }
    const player = this.getPlayerFromRoom(room, targetPlayerId);
    const timer = room.reconnectTimers.get(targetPlayerId);
    if (timer !== undefined) {
      clearTimeout(timer);
      room.reconnectTimers.delete(targetPlayerId);
    }
    room.players.delete(targetPlayerId);
    return { socketId: player.socketId };
  }

  endGameForExit(code: string, playerId: string): PublicGameState | undefined {
    const room = this.getRoom(code);
    if (room.game === undefined) {
      return undefined;
    }
    const gameState = room.game.getState();
    if (gameState.status !== 'PLAYING') {
      return undefined;
    }
    const player = this.getPlayerFromRoom(room, playerId);
    // Only a player still holding cards (ACTIVE) can lose the match by exiting — this is also
    // what the raw socket 'disconnect' handler calls for ANY dropped connection, so without
    // this guard, a player who already finished (emptied their hand) and explicitly chose to
    // leave or spectate would retroactively become the Gadha Chor the moment their socket
    // later disconnects, even though they'd already won.
    if (gameState.players.find((candidate) => candidate.id === playerId)?.status !== 'ACTIVE') {
      return undefined;
    }
    room.game.forceEndGame(playerId);
    player.postGameChoice = 'LEFT';
    this.clearPendingTransferIfInvolves(room, playerId);
    return this.publicGameState(room, playerId);
  }

  // A pending "give me your hand" request left dangling because either side disconnected
  // or exited would otherwise softlock playCard forever (it refuses to run while one is
  // outstanding) — drop it so the game can continue normally.
  private clearPendingTransferIfInvolves(room: Room, playerId: string): void {
    const pending = room.pendingTransferRequest;
    if (pending?.requesterId === playerId || pending?.targetId === playerId) {
      delete room.pendingTransferRequest;
    }
  }

  leaveGame(code: string, playerId: string): void {
    const room = this.getRoom(code);
    const player = this.getPlayerFromRoom(room, playerId);
    const gameStatus = room.game
      ?.getState()
      .players.find((candidate) => candidate.id === playerId)?.status;
    if (gameStatus !== 'FINISHED') {
      throw new Error('Only players who have finished the game can leave.');
    }
    player.postGameChoice = 'LEFT';
  }

  spectateGame(code: string, playerId: string): void {
    const room = this.getRoom(code);
    const player = this.getPlayerFromRoom(room, playerId);
    const gameStatus = room.game
      ?.getState()
      .players.find((candidate) => candidate.id === playerId)?.status;
    if (gameStatus !== 'FINISHED') {
      throw new Error('Only players who have finished the game can spectate.');
    }
    player.postGameChoice = 'SPECTATING';
  }

  getWalletBalance(playerId: string): number {
    return this.walletLedger.getBalance(playerId);
  }

  getPublicGameState(code: string, playerId: string): PublicGameState {
    const room = this.getRoom(code);
    return this.publicGameState(room, playerId);
  }

  getPublicGameStateIfStarted(code: string, playerId: string): PublicGameState | undefined {
    const room = this.getRoom(code);
    if (room.game === undefined) {
      return undefined;
    }
    return this.publicGameState(room, playerId);
  }

  getPlayer(code: string, playerId: string): RoomPlayerSnapshot {
    const room = this.getRoom(code);
    const player = this.getPlayerFromRoom(room, playerId);
    return { ...player, isHost: room.hostPlayerId === playerId };
  }

  private publicGameState(room: Room, viewerId: string): PublicGameState {
    if (room.game === undefined) {
      throw new Error('Game has not started.');
    }
    const state = room.game.getState();
    const viewer = state.players.find((player) => player.id === viewerId);
    if (viewer === undefined) {
      throw new Error('Player is not in this room.');
    }
    return {
      status: state.status,
      players: state.players.map((player) => {
        const roomPlayer = room.players.get(player.id);
        if (roomPlayer === undefined) {
          throw new Error('Room and game player state are inconsistent.');
        }
        return this.publicPlayer(room, roomPlayer, player.hand.length, player.status);
      }),
      currentPlayerId: state.currentPlayerId,
      chaalLeaderId: state.chaalLeaderId,
      requiredSuit: state.requiredSuit,
      currentChaal: state.currentChaal.map((play) => ({ ...play, card: play.card })),
      ownCards: viewer.hand,
      firstMovePending: state.firstMovePending,
      gadhaChorId: state.gadhaChorId,
    };
  }

  private publicPlayer(
    room: Room,
    player: RoomPlayer,
    cardsRemaining?: number,
    status?: PublicPlayer['status'],
  ): PublicPlayer {
    const gamePlayer = room.game
      ?.getState()
      .players.find((candidate) => candidate.id === player.id);
    return {
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      cardsRemaining: cardsRemaining ?? gamePlayer?.hand.length ?? 0,
      status: player.postGameChoice ?? status ?? gamePlayer?.status ?? 'ACTIVE',
      ready: player.ready,
      connected: player.connected,
      isHost: room.hostPlayerId === player.id,
    };
  }

  private getPlayerFromRoom(room: Room, playerId: string): RoomPlayer {
    const player = room.players.get(playerId);
    if (player === undefined) {
      throw new Error('Player is not in this room.');
    }
    return player;
  }

  private createRoomCode(): string {
    let code = '';
    do {
      code = `GC-${randomInt(1000, 10000)}`;
    } while (this.rooms.has(code));
    return code;
  }

  private cleanName(name: string): string {
    const cleanName = name.trim().slice(0, 24);
    if (cleanName.length === 0) {
      throw new Error('Player name is required.');
    }
    return cleanName;
  }
}
