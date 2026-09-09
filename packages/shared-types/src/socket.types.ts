import type { Card, GameStatus } from '@gadha-chor/game-engine';

export const PLAYER_STATUSES = ['ACTIVE', 'FINISHED', 'SPECTATING', 'LEFT'] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const AVATAR_OPTIONS = ['sun', 'moon', 'star', 'bolt', 'leaf', 'crown'] as const;
export type AvatarId = (typeof AVATAR_OPTIONS)[number];

export const AVATAR_SYMBOLS: Record<AvatarId, string> = {
  sun: '☀',
  moon: '☾',
  star: '★',
  bolt: 'ϟ',
  leaf: '❧',
  crown: '♛',
};

export const REACTION_OPTIONS = ['clap', 'heart', 'laugh', 'fire', 'wow'] as const;
export type ReactionId = (typeof REACTION_OPTIONS)[number];

export const REACTION_SYMBOLS: Record<ReactionId, string> = {
  clap: '👏',
  heart: '❤️',
  laugh: '😂',
  fire: '🔥',
  wow: '😮',
};

export type PublicPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatar: AvatarId;
  readonly cardsRemaining: number;
  readonly status: PlayerStatus;
  readonly ready: boolean;
  readonly connected: boolean;
  readonly isHost: boolean;
};

export type VisibleCard = Card;

export type PublicGameState = {
  readonly status: GameStatus;
  readonly players: readonly PublicPlayer[];
  readonly currentPlayerId?: string | undefined;
  readonly chaalLeaderId?: string | undefined;
  readonly requiredSuit?: Card['suit'] | undefined;
  readonly currentChaal: readonly {
    readonly playerId: string;
    readonly card: VisibleCard;
    readonly isInaam: boolean;
  }[];
  readonly ownCards: readonly VisibleCard[];
  readonly firstMovePending: boolean;
  readonly gadhaChorId?: string | undefined;
};

export type RoomSummary = {
  readonly code: string;
  readonly hostPlayerId: string;
  readonly status: 'LOBBY' | 'PLAYING' | 'GAME_OVER';
  readonly players: readonly PublicPlayer[];
  readonly entryPoints: number;
  readonly pool?: number | undefined;
  readonly showCardCounts: boolean;
};

export type ClientToServerEvents = {
  'voice:join': (callback: (response: ActionResponse) => void) => void;
  'voice:leave': () => void;
  'voice:offer': (payload: {
    readonly targetPlayerId: string;
    readonly offer: { readonly type: string; readonly sdp?: string | undefined };
  }) => void;
  'voice:answer': (payload: {
    readonly targetPlayerId: string;
    readonly answer: { readonly type: string; readonly sdp?: string | undefined };
  }) => void;
  'voice:ice-candidate': (payload: {
    readonly targetPlayerId: string;
    readonly candidate: {
      readonly candidate?: string | undefined;
      readonly sdpMid?: string | null;
      readonly sdpMLineIndex?: number | null;
    };
  }) => void;
  'room:create': (
    payload: {
      readonly name: string;
      readonly avatar: AvatarId;
      readonly entryPoints: number;
      readonly showCardCounts?: boolean | undefined;
    },
    callback: (response: RoomResponse) => void,
  ) => void;
  'room:join': (
    payload: { readonly code: string; readonly name: string; readonly avatar: AvatarId },
    callback: (response: RoomResponse) => void,
  ) => void;
  'room:leave': (callback: (response: ActionResponse) => void) => void;
  'room:kick': (
    payload: { readonly targetPlayerId: string },
    callback: (response: ActionResponse) => void,
  ) => void;
  'game:leave': (callback: (response: ActionResponse) => void) => void;
  'game:spectate': (callback: (response: ActionResponse) => void) => void;
  'game:exit': (callback: (response: ActionResponse) => void) => void;
  'player:ready': (
    payload: { readonly ready: boolean },
    callback: (response: ActionResponse) => void,
  ) => void;
  'game:start': (callback: (response: ActionResponse) => void) => void;
  'card:play': (
    payload: { readonly cardId: string },
    callback: (response: ActionResponse) => void,
  ) => void;
  'game:reconnect': (
    payload: { readonly code: string; readonly playerId: string },
    callback: (response: RoomResponse) => void,
  ) => void;
  'player:react': (
    payload: { readonly targetPlayerId: string; readonly reaction: ReactionId },
    callback: (response: ActionResponse) => void,
  ) => void;
};

export type ServerToClientEvents = {
  'voice:peer-joined': (payload: {
    readonly playerId: string;
    readonly initiator: boolean;
  }) => void;
  'voice:peer-left': (payload: { readonly playerId: string }) => void;
  'voice:offer': (payload: {
    readonly fromPlayerId: string;
    readonly offer: { readonly type: string; readonly sdp?: string | undefined };
  }) => void;
  'voice:answer': (payload: {
    readonly fromPlayerId: string;
    readonly answer: { readonly type: string; readonly sdp?: string | undefined };
  }) => void;
  'voice:ice-candidate': (payload: {
    readonly fromPlayerId: string;
    readonly candidate: {
      readonly candidate?: string | undefined;
      readonly sdpMid?: string | null;
      readonly sdpMLineIndex?: number | null;
    };
  }) => void;
  'room:updated': (room: RoomSummary) => void;
  'room:kicked': () => void;
  'game:started': (state: PublicGameState) => void;
  'game:state': (state: PublicGameState) => void;
  'turn:changed': (playerId: string | undefined) => void;
  'card:played': (payload: {
    readonly playerId: string;
    readonly cardId: string;
    readonly isInaam: boolean;
  }) => void;
  'chaal:completed': (payload: { readonly winnerId: string }) => void;
  'inaam:given': (payload: {
    readonly playerId: string;
    readonly cardId: string;
    readonly leaderId: string;
  }) => void;
  'player:finished': (payload: { readonly playerId: string; readonly reward: number }) => void;
  'wallet:updated': (payload: { readonly balance: number }) => void;
  'player:disconnected': (playerId: string) => void;
  'player:reconnected': (playerId: string) => void;
  'game:over': (payload: { readonly gadhaChorId: string; readonly state: PublicGameState }) => void;
  'player:reacted': (payload: {
    readonly fromPlayerId: string;
    readonly targetPlayerId: string;
    readonly reaction: ReactionId;
  }) => void;
};

export type RoomResponse =
  | {
      readonly ok: true;
      readonly room: RoomSummary;
      readonly playerId: string;
      readonly walletBalance: number;
      readonly state?: PublicGameState | undefined;
    }
  | { readonly ok: false; readonly error: string };

export type ActionResponse = { readonly ok: true } | { readonly ok: false; readonly error: string };
