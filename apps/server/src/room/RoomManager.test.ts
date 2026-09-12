import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomManager } from './RoomManager.js';
import { InMemoryWalletLedger } from '../wallet/InMemoryWalletLedger.js';
import { calculateWinnerReward } from '../wallet/reward.js';
import type { WalletLedger } from '../wallet/WalletLedger.js';
import type { PublicGameState } from '@gadha-chor/shared-types';

const ENTRY_POINTS = 100;

/** Gives the first player it ever sees a generous balance and every later player a stingy one,
 * so a room's host can afford to create it while a subsequent joiner cannot afford to join it. */
class TieredWalletLedger implements WalletLedger {
  private readonly balances = new Map<string, number>();
  private seenCount = 0;

  getBalance(playerId: string): number {
    const existing = this.balances.get(playerId);
    if (existing !== undefined) {
      return existing;
    }
    this.seenCount += 1;
    const startingBalance = this.seenCount === 1 ? 10_000 : 10;
    this.balances.set(playerId, startingBalance);
    return startingBalance;
  }

  debit(playerId: string, amount: number): void {
    const balance = this.getBalance(playerId);
    if (balance < amount) {
      throw new Error('Insufficient balance.');
    }
    this.balances.set(playerId, balance - amount);
  }

  credit(playerId: string, amount: number): void {
    this.balances.set(playerId, this.getBalance(playerId) + amount);
  }
}

function playGameToCompletion(
  manager: RoomManager,
  code: string,
  firstPlayerId: string,
): { finalState: PublicGameState; finishes: { playerId: string; reward: number }[] } {
  const finishes: { playerId: string; reward: number }[] = [];
  let state = manager.getPublicGameState(code, firstPlayerId);

  for (let turn = 0; state.status !== 'GAME_OVER' && turn < 500; turn += 1) {
    const currentPlayerId = state.currentPlayerId;
    if (currentPlayerId === undefined) {
      throw new Error('A playable game must have a current player.');
    }
    const viewerState = manager.getPublicGameState(code, currentPlayerId);
    const playableCard = viewerState.firstMovePending
      ? viewerState.ownCards.find((card) => card.suit === 'spades' && card.rank === 14)
      : (viewerState.ownCards.find(
          (card) =>
            viewerState.requiredSuit === undefined || card.suit === viewerState.requiredSuit,
        ) ?? viewerState.ownCards[0]);
    if (playableCard === undefined) {
      throw new Error('An active player must have a card to play.');
    }

    const result = manager.playCard(code, currentPlayerId, playableCard.id);
    for (const finishedPlayerId of result.finishedPlayerIds) {
      finishes.push({ playerId: finishedPlayerId, reward: result.rewards[finishedPlayerId] ?? 0 });
    }
    state = result.state;
  }

  return { finalState: state, finishes };
}

describe('RoomManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a room and allows players to join', () => {
    const manager = new RoomManager();
    const host = manager.createRoom(' Aslam ', 'beard-glasses', 'socket-host', ENTRY_POINTS);
    const guest = manager.joinRoom(host.code.toLowerCase(), 'Rahul', 'wink-tongue', 'socket-guest');
    const summary = manager.getRoomSummary(host.code);

    expect(host.code).toMatch(/^GC-\d{4}$/);
    expect(guest.playerId).not.toBe(host.playerId);
    expect(summary.players.map((player) => player.name)).toEqual(['Aslam', 'Rahul']);
    expect(summary.hostPlayerId).toBe(host.playerId);
    expect(summary.players[0]?.ready).toBe(true);
    expect(summary.entryPoints).toBe(ENTRY_POINTS);
  });

  it('requires three ready players and only permits the host to start', () => {
    const manager = new RoomManager();
    const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
    const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');

    expect(() => manager.startGame(host.code, host.playerId)).toThrow(/At least 3/);
    const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
    manager.setReady(host.code, second.playerId, true);
    manager.setReady(host.code, third.playerId, true);
    expect(() => manager.startGame(host.code, second.playerId)).toThrow(/Only the host/);

    const { state } = manager.startGame(host.code, host.playerId);
    expect(state.status).toBe('PLAYING');
    expect(state.players.every((player) => player.cardsRemaining > 0)).toBe(true);
  });

  it('shows each player their own cards but only counts for opponents', () => {
    const manager = new RoomManager();
    const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
    const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
    const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');

    for (const player of [host, second, third]) {
      manager.setReady(host.code, player.playerId, true);
    }
    manager.startGame(host.code, host.playerId);

    const hostState = manager.getPublicGameState(host.code, host.playerId);
    const guestState = manager.getPublicGameState(host.code, second.playerId);
    const hostCards = new Set(hostState.ownCards.map((card) => card.id));

    expect(hostState.ownCards).toHaveLength(18);
    expect(guestState.ownCards).toHaveLength(17);
    expect(hostState.players.find((player) => player.id === second.playerId)?.cardsRemaining).toBe(
      17,
    );
    expect(hostState.currentChaal).toHaveLength(0);
    expect(
      [...hostCards].every((cardId) => !guestState.ownCards.some((card) => card.id === cardId)),
    ).toBe(true);
  });

  it('restores a disconnected player within the reconnect window', () => {
    vi.useFakeTimers();
    const manager = new RoomManager();
    const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
    let expired = false;

    manager.disconnect(host.code, host.playerId, () => {
      expired = true;
    });
    expect(manager.getRoomSummary(host.code).players[0]?.connected).toBe(false);
    manager.reconnect(host.code, host.playerId, 'socket-new');
    vi.advanceTimersByTime(60_000);

    expect(expired).toBe(false);
    expect(manager.getPlayer(host.code, host.playerId).socketId).toBe('socket-new');
    expect(manager.getPlayer(host.code, host.playerId).connected).toBe(true);
  });

  it('returns no game state on reconnect when the game has not started yet', () => {
    const manager = new RoomManager();
    const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);

    expect(manager.getPublicGameStateIfStarted(host.code, host.playerId)).toBeUndefined();
  });

  it('returns the game state on reconnect once the game has started', () => {
    const manager = new RoomManager();
    const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
    const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
    const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
    manager.setReady(host.code, second.playerId, true);
    manager.setReady(host.code, third.playerId, true);
    manager.startGame(host.code, host.playerId);

    const state = manager.getPublicGameStateIfStarted(host.code, host.playerId);
    expect(state?.status).toBe('PLAYING');
  });

  it('expires disconnected players after the reconnect window', () => {
    vi.useFakeTimers();
    const manager = new RoomManager(1000);
    const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
    let expired = false;

    manager.disconnect(host.code, host.playerId, () => {
      expired = true;
    });
    vi.advanceTimersByTime(1000);

    expect(expired).toBe(true);
    expect(() => manager.getRoomSummary(host.code)).toThrow(/not found/);
  });

  describe('entry points and wallet', () => {
    it('rejects a non-positive entry points value', () => {
      const manager = new RoomManager();
      expect(() => manager.createRoom('Aslam', 'beard-glasses', 'socket-host', 0)).toThrow(
        /positive number/,
      );
      expect(() => manager.createRoom('Aslam', 'beard-glasses', 'socket-host', -5)).toThrow(
        /positive number/,
      );
    });

    it('rejects room creation when the host cannot afford the entry points', () => {
      const manager = new RoomManager(60_000, new InMemoryWalletLedger(50));
      expect(() =>
        manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS),
      ).toThrow(/Insufficient balance/);
    });

    it('rejects joining a room the player cannot afford', () => {
      const manager = new RoomManager(60_000, new TieredWalletLedger());
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      expect(() => manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-guest')).toThrow(
        /Insufficient balance/,
      );
    });

    it('deducts entry points from every player atomically when the game starts', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);

      const startingBalance = manager.getWalletBalance(host.playerId);
      const { balances } = manager.startGame(host.code, host.playerId);

      expect(manager.getWalletBalance(host.playerId)).toBe(startingBalance - ENTRY_POINTS);
      expect(manager.getWalletBalance(second.playerId)).toBe(startingBalance - ENTRY_POINTS);
      expect(balances).toHaveLength(3);
      expect(balances.every((balance) => balance.balance === startingBalance - ENTRY_POINTS)).toBe(
        true,
      );
      expect(manager.getRoomSummary(host.code).pool).toBe(ENTRY_POINTS * 3);
    });

    it('credits each winner an equal share of the pool the instant they finish, never the Gadha Chor', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      const startingBalance = manager.getWalletBalance(host.playerId);
      manager.startGame(host.code, host.playerId);

      const { finalState, finishes } = playGameToCompletion(manager, host.code, host.playerId);

      const expectedReward = calculateWinnerReward(ENTRY_POINTS * 3, 3);
      expect(finishes).toHaveLength(2);
      expect(finishes.every((finish) => finish.reward === expectedReward)).toBe(true);
      expect(finishes.map((finish) => finish.playerId)).not.toContain(finalState.gadhaChorId);

      for (const finish of finishes) {
        expect(manager.getWalletBalance(finish.playerId)).toBe(
          startingBalance - ENTRY_POINTS + expectedReward,
        );
      }
      expect(manager.getWalletBalance(finalState.gadhaChorId as string)).toBe(
        startingBalance - ENTRY_POINTS,
      );
    });
  });

  describe('leaving and spectating after finishing', () => {
    it('rejects leaving or spectating before the player has finished', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);

      expect(() => manager.leaveGame(host.code, host.playerId)).toThrow(/finished the game/);
      expect(() => manager.spectateGame(host.code, host.playerId)).toThrow(/finished the game/);
    });

    it('lets a finished player choose to leave or spectate, reflected in the room summary', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);

      const { finishes } = playGameToCompletion(manager, host.code, host.playerId);
      const [winnerA, winnerB] = finishes.map((finish) => finish.playerId);

      manager.leaveGame(host.code, winnerA as string);
      manager.spectateGame(host.code, winnerB as string);

      const summary = manager.getRoomSummary(host.code);
      expect(summary.players.find((player) => player.id === winnerA)?.status).toBe('LEFT');
      expect(summary.players.find((player) => player.id === winnerB)?.status).toBe('SPECTATING');
    });
  });

  describe('playing again after a match ends', () => {
    it('rejects playing again before the current match has finished', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);

      expect(() => manager.playAgain(host.code, host.playerId)).toThrow(/has not finished/);

      manager.startGame(host.code, host.playerId);
      expect(() => manager.playAgain(host.code, host.playerId)).toThrow(/has not finished/);
    });

    it('resets the room to a lobby-ready state, and a full new game can be started', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);
      playGameToCompletion(manager, host.code, host.playerId);

      // Any player in the room (not just the host) can trigger the reset.
      manager.playAgain(host.code, second.playerId);

      const summary = manager.getRoomSummary(host.code);
      expect(summary.status).toBe('LOBBY');
      expect(summary.pool).toBeUndefined();
      for (const player of summary.players) {
        expect(player.status).toBe('ACTIVE');
        expect(player.ready).toBe(player.isHost);
      }

      // Non-host players must ready up again before the host can start a new match.
      expect(() => manager.startGame(host.code, host.playerId)).toThrow(/must be ready/);
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);

      const startingBalance = manager.getWalletBalance(second.playerId);
      manager.startGame(host.code, host.playerId);
      expect(manager.getRoomSummary(host.code).status).toBe('PLAYING');
      // Entry points are deducted again for the new match, same as the first time.
      expect(manager.getWalletBalance(second.playerId)).toBe(startingBalance - ENTRY_POINTS);

      const { finalState } = playGameToCompletion(manager, host.code, host.playerId);
      expect(finalState.status).toBe('GAME_OVER');
    });
  });

  describe('kicking players from the lobby', () => {
    it('lets only the host remove a player before the game starts', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');

      expect(() => manager.kickPlayer(host.code, second.playerId, third.playerId)).toThrow(
        /Only the host/,
      );

      const { socketId } = manager.kickPlayer(host.code, host.playerId, second.playerId);
      expect(socketId).toBe('socket-second');
      expect(manager.getRoomSummary(host.code).players.map((player) => player.id)).toEqual([
        host.playerId,
        third.playerId,
      ]);
    });

    it('rejects the host removing themself or removing anyone after the game starts', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');

      expect(() => manager.kickPlayer(host.code, host.playerId, host.playerId)).toThrow(
        /cannot remove themself/,
      );

      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);

      expect(() => manager.kickPlayer(host.code, host.playerId, second.playerId)).toThrow(
        /game has started/,
      );
    });
  });

  describe('leaving the lobby', () => {
    it('removes a non-host player without disturbing the host', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');

      manager.leave(host.code, second.playerId);

      const summary = manager.getRoomSummary(host.code);
      expect(summary.players.map((player) => player.id)).toEqual([host.playerId]);
      expect(summary.hostPlayerId).toBe(host.playerId);
    });

    it('promotes the next remaining player to host when the host leaves', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');

      manager.leave(host.code, host.playerId);

      const summary = manager.getRoomSummary(host.code);
      expect(summary.hostPlayerId).toBe(second.playerId);
      expect(summary.players.map((player) => player.id)).toEqual([second.playerId, third.playerId]);
      expect(summary.players.find((player) => player.id === second.playerId)?.ready).toBe(true);
    });

    it('deletes the room once the last player leaves', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);

      manager.leave(host.code, host.playerId);

      expect(() => manager.getRoomSummary(host.code)).toThrow();
    });
  });

  describe('exiting mid-game', () => {
    it('immediately ends the game and marks the exiting player as Gadha Chor and LEFT', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);

      const endedState = manager.endGameForExit(host.code, second.playerId);

      expect(endedState?.status).toBe('GAME_OVER');
      expect(endedState?.gadhaChorId).toBe(second.playerId);
      expect(
        manager.getRoomSummary(host.code).players.find((p) => p.id === second.playerId)?.status,
      ).toBe('LEFT');
    });

    it('does nothing when the game has not started or is already over', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      expect(manager.endGameForExit(host.code, host.playerId)).toBeUndefined();

      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);
      manager.endGameForExit(host.code, second.playerId);

      expect(manager.endGameForExit(host.code, third.playerId)).toBeUndefined();
    });

    it('never blames a player who already finished, even after they leave and later disconnect', () => {
      const manager = new RoomManager();
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);

      let state = manager.getPublicGameState(host.code, host.playerId);
      let firstFinishedId: string | undefined;
      for (let turn = 0; firstFinishedId === undefined && turn < 500; turn += 1) {
        const currentPlayerId = state.currentPlayerId;
        if (currentPlayerId === undefined) {
          throw new Error('A playable game must have a current player.');
        }
        const viewerState = manager.getPublicGameState(host.code, currentPlayerId);
        const playableCard = viewerState.firstMovePending
          ? viewerState.ownCards.find((card) => card.suit === 'spades' && card.rank === 14)
          : (viewerState.ownCards.find(
              (card) =>
                viewerState.requiredSuit === undefined || card.suit === viewerState.requiredSuit,
            ) ?? viewerState.ownCards[0]);
        if (playableCard === undefined) {
          throw new Error('An active player must have a card to play.');
        }
        const result = manager.playCard(host.code, currentPlayerId, playableCard.id);
        state = result.state;
        firstFinishedId = result.finishedPlayerIds[0];
      }
      if (firstFinishedId === undefined) {
        throw new Error('Expected some player to finish before the game ended.');
      }

      // Real client flow: a finished player explicitly chooses to leave.
      manager.leaveGame(host.code, firstFinishedId);
      expect(
        manager.getRoomSummary(host.code).players.find((p) => p.id === firstFinishedId)?.status,
      ).toBe('LEFT');

      // The raw socket 'disconnect' handler calls endGameForExit for EVERY dropped connection —
      // including this now-departed, already-finished player's, whenever their socket later
      // drops. That must be a no-op: they already won, so they can never retroactively become
      // the Gadha Chor just because their connection dropped afterward.
      expect(manager.endGameForExit(host.code, firstFinishedId)).toBeUndefined();
      expect(manager.getPublicGameState(host.code, host.playerId).status).toBe('PLAYING');

      const { finalState } = playGameToCompletion(manager, host.code, host.playerId);
      expect(finalState.status).toBe('GAME_OVER');
      expect(finalState.gadhaChorId).not.toBe(firstFinishedId);
    });
  });

  describe('requesting a card transfer', () => {
    // Plays exactly one full chaal so the game settles back into "leading, chaal empty"
    // state (the only state a transfer request can be made from) and returns whichever
    // player is leading next.
    function playOneChaal(
      manager: RoomManager,
      code: string,
      anyPlayerId: string,
    ): PublicGameState {
      let state = manager.getPublicGameState(code, anyPlayerId);
      const activeCount = state.players.filter((player) => player.status === 'ACTIVE').length;
      for (let turn = 0; turn < activeCount; turn += 1) {
        const currentPlayerId = state.currentPlayerId;
        if (currentPlayerId === undefined) {
          throw new Error('A playable game must have a current player.');
        }
        const viewerState = manager.getPublicGameState(code, currentPlayerId);
        const playableCard = viewerState.firstMovePending
          ? viewerState.ownCards.find((card) => card.suit === 'spades' && card.rank === 14)
          : (viewerState.ownCards.find(
              (card) =>
                viewerState.requiredSuit === undefined || card.suit === viewerState.requiredSuit,
            ) ?? viewerState.ownCards[0]);
        if (playableCard === undefined) {
          throw new Error('An active player must have a card to play.');
        }
        state = manager.playCard(code, currentPlayerId, playableCard.id).state;
      }
      return state;
    }

    function setUpLeadingGame(manager: RoomManager): {
      host: { code: string; playerId: string };
      second: { code: string; playerId: string };
      third: { code: string; playerId: string };
      leadingState: PublicGameState;
    } {
      const host = manager.createRoom('Aslam', 'beard-glasses', 'socket-host', ENTRY_POINTS);
      const second = manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-second');
      const third = manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-third');
      manager.setReady(host.code, second.playerId, true);
      manager.setReady(host.code, third.playerId, true);
      manager.startGame(host.code, host.playerId);
      const leadingState = playOneChaal(manager, host.code, host.playerId);
      return { host, second, third, leadingState };
    }

    it('moves the hand over and rewards the target once the target accepts', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const targetId = leadingState.players.find((player) => player.id !== leaderId)?.id as string;
      const targetHandSize = leadingState.players.find((player) => player.id === targetId)
        ?.cardsRemaining as number;
      const leaderHandSize = leadingState.players.find((player) => player.id === leaderId)
        ?.cardsRemaining as number;
      const startingBalance = manager.getWalletBalance(targetId);

      manager.requestCardTransfer(host.code, leaderId, targetId);
      const result = manager.respondCardTransfer(host.code, targetId, true);

      const state = manager.getPublicGameState(host.code, leaderId);
      expect(result.accepted).toBe(true);
      expect(result.requesterId).toBe(leaderId);
      expect(state.players.find((player) => player.id === targetId)?.cardsRemaining).toBe(0);
      expect(state.players.find((player) => player.id === targetId)?.status).toBe('FINISHED');
      expect(state.players.find((player) => player.id === leaderId)?.cardsRemaining).toBe(
        leaderHandSize + targetHandSize,
      );
      expect(manager.getWalletBalance(targetId)).toBeGreaterThan(startingBalance);
      // The leader hadn't played a card — taking a hand isn't a move, so play stays with them.
      expect(state.currentPlayerId).toBe(leaderId);
    });

    it('rejects requesting a transfer once fewer than 3 players remain active', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const [firstTargetId, secondTargetId] = leadingState.players
        .filter((player) => player.id !== leaderId)
        .map((player) => player.id) as [string, string];

      manager.requestCardTransfer(host.code, leaderId, firstTargetId);
      manager.respondCardTransfer(host.code, firstTargetId, true);

      // Only the leader and secondTargetId are active now — below the 3-player floor.
      expect(() => manager.requestCardTransfer(host.code, leaderId, secondTargetId)).toThrow(
        /at least 3 active players/i,
      );
    });

    it('leaves everything unchanged when the target declines', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const targetId = leadingState.players.find((player) => player.id !== leaderId)?.id as string;

      manager.requestCardTransfer(host.code, leaderId, targetId);
      const result = manager.respondCardTransfer(host.code, targetId, false);

      const state = manager.getPublicGameState(host.code, leaderId);
      expect(result.accepted).toBe(false);
      expect(state.players.find((player) => player.id === targetId)?.status).toBe('ACTIVE');
      expect(state.currentPlayerId).toBe(leaderId);
      // The lead is free to play a normal card again once the request is resolved.
      const card = state.ownCards.find(
        (candidate) => state.requiredSuit === undefined || candidate.suit === state.requiredSuit,
      );
      expect(() =>
        manager.playCard(host.code, leaderId, (card as { id: string }).id),
      ).not.toThrow();
    });

    it('rejects a request from anyone other than the current leader', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const [otherA, otherB] = leadingState.players
        .filter((player) => player.id !== leaderId)
        .map((player) => player.id);

      expect(() =>
        manager.requestCardTransfer(host.code, otherA as string, otherB as string),
      ).toThrow(/not this player's turn/);
    });

    it('rejects a request made mid-chaal', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const leaderView = manager.getPublicGameState(host.code, leaderId);
      const card = leaderView.ownCards.find(
        (candidate) =>
          leaderView.requiredSuit === undefined || candidate.suit === leaderView.requiredSuit,
      );
      const afterOnePlay = manager.playCard(host.code, leaderId, (card as { id: string }).id).state;
      const newCurrentPlayerId = afterOnePlay.currentPlayerId as string;
      const someoneElse = afterOnePlay.players.find((player) => player.id !== newCurrentPlayerId)
        ?.id as string;

      expect(() => manager.requestCardTransfer(host.code, newCurrentPlayerId, someoneElse)).toThrow(
        /leading a new chaal/,
      );
    });

    it('rejects a duplicate request while one is already pending, and blocks normal play too', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const targetId = leadingState.players.find((player) => player.id !== leaderId)?.id as string;
      manager.requestCardTransfer(host.code, leaderId, targetId);

      expect(() => manager.requestCardTransfer(host.code, leaderId, targetId)).toThrow(
        /already pending/,
      );
      const card = leadingState.ownCards[0] as { id: string };
      expect(() => manager.playCard(host.code, leaderId, card.id)).toThrow(/pending/);
    });

    it('rejects responding when there is no pending request for that player', () => {
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;

      expect(() => manager.respondCardTransfer(host.code, leaderId, true)).toThrow(
        /no pending card transfer/,
      );
    });

    it('drops a pending request if the target disconnects, so the game does not get stuck', () => {
      vi.useFakeTimers();
      const manager = new RoomManager();
      const { host, leadingState } = setUpLeadingGame(manager);
      const leaderId = leadingState.currentPlayerId as string;
      const targetId = leadingState.players.find((player) => player.id !== leaderId)?.id as string;
      manager.requestCardTransfer(host.code, leaderId, targetId);

      manager.disconnect(host.code, targetId, () => {});

      const leaderView = manager.getPublicGameState(host.code, leaderId);
      const card = leaderView.ownCards.find(
        (candidate) =>
          leaderView.requiredSuit === undefined || candidate.suit === leaderView.requiredSuit,
      );
      expect(() =>
        manager.playCard(host.code, leaderId, (card as { id: string }).id),
      ).not.toThrow();
    });
  });

  describe('quick match', () => {
    it('creates a public room targeting the requested headcount when none is open', () => {
      const manager = new RoomManager();
      const session = manager.quickMatch('Aslam', 'beard-glasses', 3, 'socket-1', ENTRY_POINTS);

      const summary = manager.getRoomSummary(session.code);
      expect(summary.isPublic).toBe(true);
      expect(summary.targetPlayerCount).toBe(3);
      expect(summary.players).toHaveLength(1);
      expect(summary.players[0]?.ready).toBe(true);
      expect(session.started).toBeUndefined();
    });

    it('joins an existing open public room with the same target instead of creating a new one', () => {
      const manager = new RoomManager();
      const first = manager.quickMatch('Aslam', 'beard-glasses', 4, 'socket-1', ENTRY_POINTS);
      const second = manager.quickMatch('Rahul', 'wink-tongue', 4, 'socket-2', ENTRY_POINTS);

      expect(second.code).toBe(first.code);
      expect(manager.getRoomSummary(first.code).players).toHaveLength(2);
    });

    it('does not join a public room targeting a different headcount', () => {
      const manager = new RoomManager();
      const first = manager.quickMatch('Aslam', 'beard-glasses', 3, 'socket-1', ENTRY_POINTS);
      const second = manager.quickMatch('Rahul', 'wink-tongue', 4, 'socket-2', ENTRY_POINTS);

      expect(second.code).not.toBe(first.code);
    });

    it('auto-starts the instant — and only the instant — the target headcount is reached', () => {
      const manager = new RoomManager();
      const first = manager.quickMatch('Aslam', 'beard-glasses', 3, 'socket-1', ENTRY_POINTS);
      const second = manager.quickMatch('Rahul', 'wink-tongue', 3, 'socket-2', ENTRY_POINTS);
      expect(second.started).toBeUndefined();
      expect(manager.getRoomSummary(first.code).status).toBe('LOBBY');

      const third = manager.quickMatch('Ali', 'donkey', 3, 'socket-3', ENTRY_POINTS);
      expect(third.started).toBeDefined();
      expect(manager.getRoomSummary(first.code).status).toBe('PLAYING');
    });

    it('never requires a manual ready-up or a host start', () => {
      const manager = new RoomManager();
      manager.quickMatch('Aslam', 'beard-glasses', 3, 'socket-1', ENTRY_POINTS);
      manager.quickMatch('Rahul', 'wink-tongue', 3, 'socket-2', ENTRY_POINTS);
      const third = manager.quickMatch('Ali', 'donkey', 3, 'socket-3', ENTRY_POINTS);

      // No setReady/startGame call anywhere above — the third join alone must have started it.
      expect(third.started?.state.status).toBe('PLAYING');
    });

    it('rejects a player count outside 3-6', () => {
      const manager = new RoomManager();
      expect(() =>
        manager.quickMatch('Aslam', 'beard-glasses', 2, 'socket-1', ENTRY_POINTS),
      ).toThrow(/between 3 and 6/);
      expect(() =>
        manager.quickMatch('Aslam', 'beard-glasses', 7, 'socket-1', ENTRY_POINTS),
      ).toThrow(/between 3 and 6/);
    });
  });

  describe('listing rooms', () => {
    it('includes a public room’s code but omits a private one’s', () => {
      const manager = new RoomManager();
      const publicRoom = manager.quickMatch('Aslam', 'beard-glasses', 3, 'socket-1', ENTRY_POINTS);
      manager.createRoom('Rahul', 'wink-tongue', 'socket-2', ENTRY_POINTS, false, false);

      const listings = manager.listRooms();
      const publicListing = listings.find((listing) => listing.isPublic);
      const privateListing = listings.find((listing) => !listing.isPublic);

      expect(publicListing?.code).toBe(publicRoom.code);
      expect(publicListing?.targetPlayerCount).toBe(3);
      expect(privateListing?.code).toBeUndefined();
    });

    it('also lists a manually-created room flagged public, with its code visible', () => {
      const manager = new RoomManager();
      const room = manager.createRoom(
        'Aslam',
        'beard-glasses',
        'socket-1',
        ENTRY_POINTS,
        false,
        true,
      );

      const listing = manager.listRooms().find((candidate) => candidate.code === room.code);
      expect(listing?.isPublic).toBe(true);
      expect(listing?.targetPlayerCount).toBeUndefined();
    });

    it('excludes a room whose game has already started', () => {
      const manager = new RoomManager();
      const host = manager.createRoom(
        'Aslam',
        'beard-glasses',
        'socket-host',
        ENTRY_POINTS,
        false,
        true,
      );
      manager.joinRoom(host.code, 'Rahul', 'wink-tongue', 'socket-2');
      manager.joinRoom(host.code, 'Ali', 'donkey', 'socket-3');
      manager.setReady(host.code, host.playerId, true);
      for (const player of manager.getRoomSummary(host.code).players) {
        manager.setReady(host.code, player.id, true);
      }
      manager.startGame(host.code, host.playerId);

      expect(manager.listRooms().some((listing) => listing.code === host.code)).toBe(false);
    });
  });
});
