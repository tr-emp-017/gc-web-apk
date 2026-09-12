import type { Card, GameStatus } from '@gadha-chor/game-engine';

export const PLAYER_STATUSES = ['ACTIVE', 'FINISHED', 'SPECTATING', 'LEFT'] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

// Each id maps to an illustrated avatar image shipped with the mobile app (see
// apps/mobile/src/constants/avatarImages.ts) — kept as plain ids here, rather than the images
// themselves, so this package stays platform-agnostic and usable from the server.
export const AVATAR_OPTIONS = [
  'beard-glasses',
  'wink-tongue',
  'donkey',
  'cool-hoodie',
  'peace-sign',
  'headphones',
  'game-on-cap',
  'dreamy-hands',
  'thinking-glasses',
  'big-laugh',
] as const;
export type AvatarId = (typeof AVATAR_OPTIONS)[number];

// Playful profile-popup reactions — every reaction is currently free (see the mobile
// ProfileModal); a price could be attached per-id later without changing this list.
export const REACTION_OPTIONS = ['rose', 'kiss', 'tea', 'slipper', 'bomb', 'egg'] as const;
export type ReactionId = (typeof REACTION_OPTIONS)[number];

export const REACTION_SYMBOLS: Record<ReactionId, string> = {
  bomb: '💣',
  egg: '🥚',
  kiss: '💋',
  rose: '🌹',
  slipper: '🩴',
  tea: '☕',
};

// A room-wide "soundboard" — any player can play one of these for everyone to hear, with the
// player's own profile flashing so it's obvious who triggered it (see the mobile game
// screen's bottom-left icon).
export const FUN_SOUND_OPTIONS = [
  'aayein-meme',
  'aisa-mat-karo',
  'aree-bas-kar-bhai',
  'cartoon-scream',
  'chala-ja-bsdk',
  'converted-clip',
  'donkey-braying',
  'donkey-classic',
  'donkey-deep',
  'donkey-small',
  'fart',
  'funny-reaction',
  'gopgopgop',
  'huh',
  'iss-sajjan-ko-kya-takleef-hai-bhai',
  'khopdi-tor-salay-ka',
  'ki-kore',
  'koun-hai-re',
  'lekin-ye-sala',
  'lund-pakad-ke-tarazu-ki-tarah-cid',
  'maa-tari-oo-bhai',
  'men-laughing',
  'monkey-classic',
  'monkey-noise',
  'mujhe-apne-ghar-jana-hai',
  'tum-dum-tedau',
  'wooooaah',
  'ye-ladki-tum-bohut-bolti-ho-chapad-chapad',
  'yeah-boy',
  'anime-ahh',
  'is-ka-karan-narendar-modi',
  'depression-indian',
  'bade-harami-ho-beta',
  'mka-ladle-meow-gop',
  'ek-gand-pe-repta-mara-n-sarak-pe-hagta-firega',
  'wow-kya-ladka-hai-very-handsome-boy',
  'cid-le-mdc',
  'khatam',
  'ek-din-mar-jayega',
  'ruko-jara',
] as const;
export type FunSoundId = (typeof FUN_SOUND_OPTIONS)[number];

export const FUN_SOUND_SYMBOLS: Record<FunSoundId, string> = {
  'aayein-meme': '😱',
  'aisa-mat-karo': '🙅',
  'aree-bas-kar-bhai': '✋',
  'cartoon-scream': '😱',
  'chala-ja-bsdk': '👋',
  'converted-clip': '🔊',
  'donkey-braying': '🐴',
  'donkey-classic': '🐴',
  'donkey-deep': '🐴',
  'donkey-small': '🐴',
  fart: '💨',
  'funny-reaction': '🤣',
  gopgopgop: '😋',
  huh: '🤨',
  'iss-sajjan-ko-kya-takleef-hai-bhai': '🤷',
  'khopdi-tor-salay-ka': '💀',
  'ki-kore': '🗣️',
  'koun-hai-re': '❓',
  'lekin-ye-sala': '😤',
  'lund-pakad-ke-tarazu-ki-tarah-cid': '⚖️',
  'maa-tari-oo-bhai': '😩',
  'men-laughing': '😂',
  'monkey-classic': '🐒',
  'monkey-noise': '🐒',
  'mujhe-apne-ghar-jana-hai': '🏠',
  'tum-dum-tedau': '🥁',
  wooooaah: '😲',
  'ye-ladki-tum-bohut-bolti-ho-chapad-chapad': '🗯️',
  'yeah-boy': '🙌',
  'anime-ahh': '😱',
  'is-ka-karan-narendar-modi': '📢',
  'depression-indian': '😔',
  'bade-harami-ho-beta': '😈',
  'mka-ladle-meow-gop': '🐱',
  'ek-gand-pe-repta-mara-n-sarak-pe-hagta-firega': '🤬',
  'wow-kya-ladka-hai-very-handsome-boy': '😎',
  'cid-le-mdc': '🕵️',
  khatam: '🏁',
  'ek-din-mar-jayega': '⚰️',
  'ruko-jara': '🛑',
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
  // Resets a finished match back to the lobby (same room, same players) for a rematch — does
  // not itself start a new game; players still ready up and the host still presses
  // 'game:start' same as the first time, which is what actually reshuffles and deducts entry
  // points again.
  'room:playAgain': (callback: (response: ActionResponse) => void) => void;
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
  'card:requestTransfer': (
    payload: { readonly targetPlayerId: string },
    callback: (response: ActionResponse) => void,
  ) => void;
  'card:respondTransfer': (
    payload: { readonly accept: boolean },
    callback: (response: ActionResponse) => void,
  ) => void;
  'sound:play': (
    payload: { readonly soundId: FunSoundId },
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
  'chaal:completed': (payload: {
    readonly winnerId: string;
    readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
  }) => void;
  'inaam:given': (payload: {
    readonly playerId: string;
    readonly cardId: string;
    readonly leaderId: string;
    // The player who actually receives every card in this chaal — whoever holds the
    // highest card of the required suit, which is usually but not always the chaal leader.
    readonly receiverId: string;
    readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
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
  'card:transferRequested': (payload: {
    readonly requesterId: string;
    readonly requesterName: string;
  }) => void;
  'card:transferResolved': (payload: {
    readonly requesterId: string;
    readonly targetId: string;
    readonly accepted: boolean;
    // How many cards moved — sent instead of the cards themselves so bystanders (and the
    // giver, once their hand empties) never see hand contents that weren't theirs. 0 when
    // declined.
    readonly cardCount: number;
  }) => void;
  'sound:played': (payload: { readonly playerId: string; readonly soundId: FunSoundId }) => void;
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
