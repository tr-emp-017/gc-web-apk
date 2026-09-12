import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import type {
  ActionResponse,
  ClientToServerEvents,
  RoomResponse,
  RoomSummary,
  ServerToClientEvents,
  PublicGameState,
  AvatarId,
  FunSoundId,
  ReactionId,
  VisibleCard,
} from '@gadha-chor/shared-types';
import { clearSession, loadSession, saveSession } from '../utils/sessionStorage';
import {
  PREVIEW_PLAYER_ID,
  PREVIEW_WALLET_BALANCE,
  createPreviewGameState,
  createPreviewRoom,
} from '../dev/previewFixtures';
import { BOT_MATCH_HUMAN_ID, createBotMatch, type BotMatch } from '../bots/botMatch';
import { pickBotIdentities } from '../bots/botIdentities';
import type { BotDifficultyId, BotPlayerCount } from '../bots/types';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ReactionNotification = {
  readonly fromPlayerId: string;
  readonly targetPlayerId: string;
  readonly reaction: ReactionId;
};

export type CompletedChaal = {
  readonly winnerId: string;
  readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
};

export type IncomingTransferRequest = {
  readonly requesterId: string;
  readonly requesterName: string;
};

export type TransferResolution = {
  readonly requesterId: string;
  readonly targetId: string;
  readonly accepted: boolean;
  readonly cardCount: number;
};

export type FunSoundPlayed = {
  readonly playerId: string;
  readonly soundId: FunSoundId;
};

export type InaamEvent = {
  readonly giverId: string;
  readonly receiverId: string;
  readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
};

type RoomStore = {
  readonly socket: GameSocket | null;
  readonly room: RoomSummary | null;
  readonly playerId: string | null;
  readonly gameState: PublicGameState | null;
  readonly error: string | null;
  readonly latestReaction: ReactionNotification | null;
  readonly walletBalance: number | null;
  readonly lastCompletedChaal: CompletedChaal | null;
  readonly incomingTransferRequest: IncomingTransferRequest | null;
  readonly transferResolution: TransferResolution | null;
  readonly lastInaam: InaamEvent | null;
  readonly lastFunSound: FunSoundPlayed | null;
  readonly previewMode: boolean;
  readonly botMode: boolean;
  readonly botMatch: BotMatch | null;
  readonly botMatchSettings: {
    readonly name: string;
    readonly avatar: AvatarId;
    readonly playerCount: BotPlayerCount;
    readonly difficulty: BotDifficultyId;
    readonly showCardCounts: boolean;
  } | null;
  enterPreviewMode: () => void;
  startBotMatch: (
    name: string,
    avatar: AvatarId,
    playerCount: BotPlayerCount,
    difficulty: BotDifficultyId,
    showCardCounts: boolean,
  ) => void;
  connect: () => GameSocket;
  clearError: () => void;
  clearLastCompletedChaal: () => void;
  clearTransferResolution: () => void;
  clearLastInaam: () => void;
  createRoom: (
    name: string,
    avatar: AvatarId,
    entryPoints: number,
    showCardCounts: boolean,
  ) => Promise<boolean>;
  joinRoom: (code: string, name: string, avatar: AvatarId) => Promise<boolean>;
  setReady: (ready: boolean) => Promise<boolean>;
  startGame: () => Promise<boolean>;
  playCard: (cardId: string) => Promise<boolean>;
  reactToPlayer: (targetPlayerId: string, reaction: ReactionId) => Promise<boolean>;
  playFunSound: (soundId: FunSoundId) => Promise<boolean>;
  requestCardTransfer: (targetPlayerId: string) => Promise<boolean>;
  respondCardTransfer: (accept: boolean) => Promise<boolean>;
  leaveGame: () => Promise<boolean>;
  spectateGame: () => Promise<boolean>;
  playAgain: () => Promise<boolean>;
  kickPlayer: (targetPlayerId: string) => Promise<boolean>;
  leaveRoom: () => Promise<boolean>;
  exitGame: () => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  returnHome: () => void;
};

const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3000';

function responseError(response: RoomResponse | ActionResponse): string | null {
  return response.ok ? null : response.error;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  socket: null,
  room: null,
  playerId: null,
  gameState: null,
  error: null,
  latestReaction: null,
  walletBalance: null,
  lastCompletedChaal: null,
  incomingTransferRequest: null,
  transferResolution: null,
  lastInaam: null,
  lastFunSound: null,
  previewMode: false,
  botMode: false,
  botMatch: null,
  botMatchSettings: null,
  // Dev-only: opens the real game screen against local mock data instead of a socket
  // connection, so the table UI can be reloaded and inspected without creating/joining a
  // room. Never invoked outside __DEV__ (see index.tsx) and every mutating action below
  // short-circuits into a local simulation whenever previewMode is true, so this can never
  // reach the server or affect a real game.
  enterPreviewMode: () => {
    set({
      error: null,
      gameState: createPreviewGameState(),
      playerId: PREVIEW_PLAYER_ID,
      previewMode: true,
      room: createPreviewRoom(),
      walletBalance: PREVIEW_WALLET_BALANCE,
    });
  },
  // "Play with Bots": a real, complete game driven by a local GameEngine instance (see
  // src/bots/botMatch.ts) — never a socket connection — so it's free, instant, and can never
  // touch the real wallet/entry-points economy. Every mutating action below short-circuits
  // into calls on the BotMatch instance whenever botMode is true, the same way previewMode
  // short-circuits into a local simulation above.
  startBotMatch: (name, avatar, playerCount, difficulty, showCardCounts) => {
    get().botMatch?.destroy();
    const trimmedName = name.trim().slice(0, 24) || 'You';
    const human = { avatar, id: BOT_MATCH_HUMAN_ID, name: trimmedName };
    const bots = pickBotIdentities(playerCount - 1);
    const match = createBotMatch(human, bots, difficulty, {
      onCompletedChaal: (event) => set({ lastCompletedChaal: event }),
      onGameState: (gameState) => set({ gameState }),
      onInaam: (event) => set({ lastInaam: event }),
      onIncomingTransferRequest: (event) => set({ incomingTransferRequest: event }),
      onTransferResolution: (event) => set({ transferResolution: event }),
    });
    const initialState = match.getPublicState();
    set({
      botMatch: match,
      botMatchSettings: { avatar, difficulty, name: trimmedName, playerCount, showCardCounts },
      botMode: true,
      error: null,
      gameState: initialState,
      incomingTransferRequest: null,
      lastCompletedChaal: null,
      lastInaam: null,
      playerId: BOT_MATCH_HUMAN_ID,
      room: {
        code: 'BOTS',
        entryPoints: 0,
        hostPlayerId: BOT_MATCH_HUMAN_ID,
        players: initialState.players,
        showCardCounts,
        status: 'PLAYING',
      },
      transferResolution: null,
      walletBalance: null,
    });
  },
  connect: () => {
    const existingSocket = get().socket;
    if (existingSocket !== null) {
      if (!existingSocket.connected) {
        existingSocket.connect();
      }
      return existingSocket;
    }

    const socket: GameSocket = io(serverUrl, { autoConnect: false });
    // A room going back to 'LOBBY' (via playAgain) means the previous match's gameState is
    // stale — there's no game any more until the host starts a new one, so drop it here rather
    // than leaving the game screen stuck showing the finished match.
    socket.on('room:updated', (room) =>
      set({ gameState: room.status === 'LOBBY' ? null : get().gameState, room }),
    );
    socket.on('game:started', (gameState) => set({ gameState }));
    socket.on('game:state', (gameState) => set({ gameState }));
    socket.on('game:over', ({ state }) => set({ gameState: state }));
    socket.on('player:reacted', (reaction) => {
      set({ latestReaction: reaction });
      setTimeout(() => {
        set((state) => (state.latestReaction === reaction ? { latestReaction: null } : state));
      }, 5000);
    });
    // No auto-clear timer here (unlike latestReaction's toast) — every event is a fresh object
    // reference from the socket, which is all game.tsx's flash-triggering effect needs to
    // detect a new play, even an identical sound played twice in a row.
    socket.on('sound:played', (payload) => set({ lastFunSound: payload }));
    socket.on('wallet:updated', ({ balance }) => set({ walletBalance: balance }));
    socket.on('chaal:completed', ({ winnerId, cards }) =>
      set({ lastCompletedChaal: { winnerId, cards } }),
    );
    socket.on('inaam:given', ({ playerId: giverId, receiverId, cards }) =>
      set({ lastInaam: { cards, giverId, receiverId } }),
    );
    socket.on('card:transferRequested', ({ requesterId, requesterName }) =>
      set({ incomingTransferRequest: { requesterId, requesterName } }),
    );
    socket.on('card:transferResolved', ({ requesterId, targetId, accepted, cardCount }) =>
      set({ transferResolution: { accepted, cardCount, requesterId, targetId } }),
    );
    socket.on('room:kicked', () => {
      clearSession();
      set({
        room: null,
        gameState: null,
        playerId: null,
        error: 'You were removed from the room by the host.',
      });
    });
    socket.on('connect_error', (error) => set({ error: error.message }));
    // A dropped/restored connection (tower handoff, wifi<->data switch, Render free-tier
    // cold start) gets a brand-new server-side socket with no room/playerId attached to it.
    // Re-run the reconnect handshake so the server re-attaches this socket to the room
    // instead of leaving every subsequent action failing with "not connected to a room".
    socket.io.on('reconnect', () => {
      const stored = loadSession();
      if (stored !== null) {
        socket.emit('game:reconnect', stored, (response) => {
          if (!response.ok) {
            clearSession();
            set({ room: null, gameState: null, playerId: null });
            return;
          }
          set({
            room: response.room,
            playerId: response.playerId,
            walletBalance: response.walletBalance,
            gameState: response.state ?? null,
            error: null,
          });
        });
      }
    });
    socket.connect();
    set({ socket });
    return socket;
  },
  clearError: () => set({ error: null }),
  clearLastCompletedChaal: () => set({ lastCompletedChaal: null }),
  clearLastInaam: () => set({ lastInaam: null }),
  clearTransferResolution: () => set({ transferResolution: null }),
  createRoom: (name, avatar, entryPoints, showCardCounts) => {
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('room:create', { name, avatar, entryPoints, showCardCounts }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        if (response.ok) {
          saveSession({ code: response.room.code, playerId: response.playerId });
          set({
            room: response.room,
            playerId: response.playerId,
            walletBalance: response.walletBalance,
            error: null,
          });
          resolve(true);
        }
      });
    });
  },
  joinRoom: (code, name, avatar) => {
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('room:join', { code: code.trim().toUpperCase(), name, avatar }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        if (response.ok) {
          saveSession({ code: response.room.code, playerId: response.playerId });
          set({
            room: response.room,
            playerId: response.playerId,
            walletBalance: response.walletBalance,
            error: null,
          });
          resolve(true);
        }
      });
    });
  },
  setReady: (ready) => {
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('player:ready', { ready }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  startGame: () => {
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('game:start', (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  playCard: (cardId) => {
    if (get().previewMode) {
      const current = get().gameState;
      if (current === null || current.currentPlayerId !== PREVIEW_PLAYER_ID) {
        return Promise.resolve(false);
      }
      const playedCard = current.ownCards.find((candidate) => candidate.id === cardId);
      if (playedCard === undefined) {
        return Promise.resolve(false);
      }
      const activePlayers = current.players.filter((player) => player.status === 'ACTIVE');
      const wasFreshChaal = current.currentChaal.length === 0;
      // Opponents never auto-play in this preview simulation, so a real 4-way trick can never
      // naturally complete. To make the game-over screen (and its win/loss lists) quick to
      // test, the very first chaal you lead ends the match immediately instead of continuing
      // to wait on bots that will never move.
      if (wasFreshChaal) {
        const gadhaChor =
          current.players.find(
            (player) => player.id !== PREVIEW_PLAYER_ID && player.status === 'ACTIVE',
          ) ?? current.players[1];
        set({
          gameState: {
            ...current,
            currentChaal: [],
            gadhaChorId: gadhaChor?.id ?? PREVIEW_PLAYER_ID,
            ownCards: current.ownCards.filter((card) => card.id !== cardId),
            players: current.players.map((player) => ({
              ...player,
              status: player.id === (gadhaChor?.id ?? PREVIEW_PLAYER_ID) ? 'ACTIVE' : 'FINISHED',
            })),
            status: 'GAME_OVER',
          },
        });
        return Promise.resolve(true);
      }
      const nextChaal = [
        ...current.currentChaal,
        { card: playedCard, isInaam: false, playerId: PREVIEW_PLAYER_ID },
      ];
      const trickFinished = nextChaal.length >= activePlayers.length;
      const currentIndex = activePlayers.findIndex((player) => player.id === PREVIEW_PLAYER_ID);
      const nextPlayerId =
        activePlayers[(currentIndex + 1) % activePlayers.length]?.id ?? PREVIEW_PLAYER_ID;
      set({
        gameState: {
          ...current,
          chaalLeaderId: current.chaalLeaderId,
          currentChaal: trickFinished ? [] : nextChaal,
          currentPlayerId: nextPlayerId,
          ownCards: current.ownCards.filter((card) => card.id !== cardId),
          players: current.players.map((player) =>
            player.id === PREVIEW_PLAYER_ID
              ? { ...player, cardsRemaining: player.cardsRemaining - 1 }
              : player,
          ),
          requiredSuit: trickFinished ? undefined : current.requiredSuit,
        },
      });
      return Promise.resolve(true);
    }
    if (get().botMode) {
      get().botMatch?.playCard(cardId);
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('card:play', { cardId }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  reactToPlayer: (targetPlayerId, reaction) => {
    if (get().previewMode) {
      const notification = { fromPlayerId: PREVIEW_PLAYER_ID, reaction, targetPlayerId };
      set({ latestReaction: notification });
      setTimeout(() => {
        set((state) => (state.latestReaction === notification ? { latestReaction: null } : state));
      }, 5000);
      return Promise.resolve(true);
    }
    if (get().botMode) {
      // Cosmetic-only broadcast — bots don't need to "see" it, just echo locally so the
      // sender's own flying-emoji effect plays, same as the previewMode branch above.
      const notification = { fromPlayerId: BOT_MATCH_HUMAN_ID, reaction, targetPlayerId };
      set({ latestReaction: notification });
      setTimeout(() => {
        set((state) => (state.latestReaction === notification ? { latestReaction: null } : state));
      }, 5000);
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('player:react', { targetPlayerId, reaction }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  playFunSound: (soundId) => {
    if (get().previewMode) {
      set({ lastFunSound: { playerId: PREVIEW_PLAYER_ID, soundId } });
      return Promise.resolve(true);
    }
    if (get().botMode) {
      set({ lastFunSound: { playerId: BOT_MATCH_HUMAN_ID, soundId } });
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('sound:play', { soundId }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  requestCardTransfer: (targetPlayerId) => {
    if (get().previewMode) {
      // Simulate the target accepting a beat later, so the "ASKING…" badge and the
      // card-transfer sweep animation are both visible in the preview, same as a real
      // accepted request would look.
      setTimeout(() => {
        const current = get().gameState;
        if (current === null) {
          return;
        }
        const target = current.players.find((player) => player.id === targetPlayerId);
        const cardCount = target?.cardsRemaining ?? 0;
        set({
          gameState: {
            ...current,
            ownCards: [
              ...current.ownCards,
              ...Array.from({ length: cardCount }, (_, index) => ({
                id: `preview-transferred-${index}`,
                rank: 2 as const,
                suit: 'spades' as const,
              })),
            ],
            players: current.players.map((player) =>
              player.id === targetPlayerId ? { ...player, cardsRemaining: 0 } : player,
            ),
          },
          transferResolution: {
            accepted: true,
            cardCount,
            requesterId: PREVIEW_PLAYER_ID,
            targetId: targetPlayerId,
          },
        });
      }, 700);
      return Promise.resolve(true);
    }
    if (get().botMode) {
      get().botMatch?.requestCardTransfer(targetPlayerId);
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('card:requestTransfer', { targetPlayerId }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  respondCardTransfer: (accept) => {
    if (get().previewMode) {
      set({ incomingTransferRequest: null });
      return Promise.resolve(true);
    }
    if (get().botMode) {
      set({ incomingTransferRequest: null });
      get().botMatch?.respondCardTransfer(accept);
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('card:respondTransfer', { accept }, (response) => {
        const error = responseError(response);
        set({ incomingTransferRequest: null });
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  leaveGame: () => {
    if (get().previewMode) {
      set({ error: null, gameState: null, playerId: null, previewMode: false, room: null });
      return Promise.resolve(true);
    }
    if (get().botMode) {
      get().botMatch?.destroy();
      set({
        botMatch: null,
        botMatchSettings: null,
        botMode: false,
        error: null,
        gameState: null,
        playerId: null,
        room: null,
      });
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('game:leave', (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        clearSession();
        set({ error: null, room: null, gameState: null });
        resolve(true);
      });
    });
  },
  spectateGame: () => {
    if (get().previewMode) {
      const current = get().gameState;
      if (current !== null) {
        set({
          gameState: {
            ...current,
            players: current.players.map((player) =>
              player.id === PREVIEW_PLAYER_ID ? { ...player, status: 'SPECTATING' } : player,
            ),
          },
        });
      }
      return Promise.resolve(true);
    }
    if (get().botMode) {
      const current = get().gameState;
      if (current !== null) {
        set({
          gameState: {
            ...current,
            players: current.players.map((player) =>
              player.id === BOT_MATCH_HUMAN_ID ? { ...player, status: 'SPECTATING' } : player,
            ),
          },
        });
      }
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('game:spectate', (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  playAgain: () => {
    if (get().previewMode) {
      // There's no real lobby to return to in preview mode — just regenerate a fresh mock
      // match in place, same as tapping the dev entry point again.
      get().enterPreviewMode();
      return Promise.resolve(true);
    }
    if (get().botMode) {
      // No real lobby here either — rebuild a fresh match with the same seat count/name/
      // avatar/difficulty the human picked on the setup screen.
      const settings = get().botMatchSettings;
      if (settings !== null) {
        get().startBotMatch(
          settings.name,
          settings.avatar,
          settings.playerCount,
          settings.difficulty,
          settings.showCardCounts,
        );
      }
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('room:playAgain', (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  kickPlayer: (targetPlayerId) => {
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('room:kick', { targetPlayerId }, (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        set({ error: null });
        resolve(true);
      });
    });
  },
  leaveRoom: () => {
    if (get().previewMode) {
      set({ error: null, gameState: null, playerId: null, previewMode: false, room: null });
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('room:leave', (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        clearSession();
        set({ error: null, room: null, gameState: null, playerId: null });
        resolve(true);
      });
    });
  },
  exitGame: () => {
    if (get().previewMode) {
      set({ error: null, gameState: null, playerId: null, previewMode: false, room: null });
      return Promise.resolve(true);
    }
    if (get().botMode) {
      get().botMatch?.destroy();
      set({
        botMatch: null,
        botMatchSettings: null,
        botMode: false,
        error: null,
        gameState: null,
        playerId: null,
        room: null,
      });
      return Promise.resolve(true);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('game:exit', (response) => {
        const error = responseError(response);
        if (error !== null) {
          set({ error });
          resolve(false);
          return;
        }
        clearSession();
        set({ error: null, room: null, gameState: null });
        resolve(true);
      });
    });
  },
  restoreSession: () => {
    const stored = loadSession();
    if (stored === null) {
      return Promise.resolve(false);
    }
    const socket = get().connect();
    return new Promise((resolve) => {
      socket.emit('game:reconnect', stored, (response) => {
        if (!response.ok) {
          clearSession();
          resolve(false);
          return;
        }
        saveSession({ code: response.room.code, playerId: response.playerId });
        set({
          room: response.room,
          playerId: response.playerId,
          walletBalance: response.walletBalance,
          gameState: response.state ?? null,
          error: null,
        });
        resolve(true);
      });
    });
  },
  returnHome: () => {
    clearSession();
    get().botMatch?.destroy();
    set({
      room: null,
      gameState: null,
      playerId: null,
      error: null,
      previewMode: false,
      botMode: false,
      botMatch: null,
      botMatchSettings: null,
    });
  },
}));
