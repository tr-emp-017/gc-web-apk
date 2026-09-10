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
  ReactionId,
} from '@gadha-chor/shared-types';
import { clearSession, loadSession, saveSession } from '../utils/sessionStorage';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ReactionNotification = {
  readonly fromPlayerId: string;
  readonly targetPlayerId: string;
  readonly reaction: ReactionId;
};

type RoomStore = {
  readonly socket: GameSocket | null;
  readonly room: RoomSummary | null;
  readonly playerId: string | null;
  readonly gameState: PublicGameState | null;
  readonly error: string | null;
  readonly latestReaction: ReactionNotification | null;
  readonly walletBalance: number | null;
  connect: () => GameSocket;
  clearError: () => void;
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
  leaveGame: () => Promise<boolean>;
  spectateGame: () => Promise<boolean>;
  kickPlayer: (targetPlayerId: string) => Promise<boolean>;
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
  connect: () => {
    const existingSocket = get().socket;
    if (existingSocket !== null) {
      if (!existingSocket.connected) {
        existingSocket.connect();
      }
      return existingSocket;
    }

    const socket: GameSocket = io(serverUrl, { autoConnect: false });
    socket.on('room:updated', (room) => set({ room }));
    socket.on('game:started', (gameState) => set({ gameState }));
    socket.on('game:state', (gameState) => set({ gameState }));
    socket.on('game:over', ({ state }) => set({ gameState: state }));
    socket.on('player:reacted', (reaction) => {
      set({ latestReaction: reaction });
      setTimeout(() => {
        set((state) => (state.latestReaction === reaction ? { latestReaction: null } : state));
      }, 5000);
    });
    socket.on('wallet:updated', ({ balance }) => set({ walletBalance: balance }));
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
  leaveGame: () => {
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
  exitGame: () => {
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
    set({ room: null, gameState: null, playerId: null, error: null });
  },
}));
