import type { AvatarId, PublicGameState, PublicPlayer, RoomSummary, VisibleCard } from '@gadha-chor/shared-types';

// Dev-only mock data for "UI Preview Mode" (see roomStore's previewMode). Never imported by
// anything that ships real gameplay logic — only enterPreviewMode() in roomStore.ts touches
// this file. Delete alongside that if the preview mode is ever removed.

export const PREVIEW_PLAYER_ID = 'preview-me';
const PREVIEW_ROOM_CODE = 'GC-PREV';

function card(id: string, suit: VisibleCard['suit'], rank: VisibleCard['rank']): VisibleCard {
  return { id, rank, suit };
}

const OPPONENT_NAMES: readonly string[] = ['Rani', 'Bunty', 'Sanya', 'Chintu', 'Meera'];
const OPPONENT_AVATARS: readonly AvatarId[] = [
  'wink-tongue',
  'donkey',
  'cool-hoodie',
  'peace-sign',
  'headphones',
];

// Deliberately mixes ACTIVE, FINISHED ("WON" badge), and SPECTATING ("WATCHING" badge) so a
// single preview shows every seat state at once, and keeps active count at 4 (>= 3) so the
// "Request all cards" profile action is visible for testing.
const OPPONENT_STATUSES: readonly PublicPlayer['status'][] = [
  'ACTIVE',
  'ACTIVE',
  'FINISHED',
  'SPECTATING',
  'ACTIVE',
];
const OPPONENT_CARD_COUNTS: readonly number[] = [9, 6, 0, 0, 11];

function buildPlayers(): readonly PublicPlayer[] {
  const me: PublicPlayer = {
    avatar: 'beard-glasses',
    cardsRemaining: 9,
    connected: true,
    id: PREVIEW_PLAYER_ID,
    isHost: true,
    name: 'You',
    ready: true,
    status: 'ACTIVE',
  };
  const opponents: readonly PublicPlayer[] = OPPONENT_NAMES.map((name, index) => ({
    avatar: OPPONENT_AVATARS[index] ?? 'beard-glasses',
    cardsRemaining: OPPONENT_CARD_COUNTS[index] ?? 0,
    connected: true,
    id: `preview-opponent-${index}`,
    isHost: false,
    name,
    ready: true,
    status: OPPONENT_STATUSES[index] ?? 'ACTIVE',
  }));
  return [me, ...opponents];
}

export function createPreviewRoom(): RoomSummary {
  return {
    code: PREVIEW_ROOM_CODE,
    entryPoints: 50,
    hostPlayerId: PREVIEW_PLAYER_ID,
    players: buildPlayers(),
    pool: 300,
    showCardCounts: true,
    status: 'PLAYING',
  };
}

export function createPreviewGameState(): PublicGameState {
  return {
    // Empty on purpose: it's your turn AND you're leading a fresh chaal, so the "Request all
    // cards" row in the profile popup is actually reachable to test — a non-empty chaal (even
    // on your turn) hides that option, matching the real in-game rule.
    chaalLeaderId: PREVIEW_PLAYER_ID,
    currentChaal: [],
    currentPlayerId: PREVIEW_PLAYER_ID,
    firstMovePending: false,
    ownCards: [
      card('preview-h1', 'spades', 14),
      card('preview-h2', 'spades', 9),
      card('preview-h3', 'hearts', 7),
      card('preview-h4', 'hearts', 2),
      card('preview-h5', 'diamonds', 12),
      card('preview-h6', 'diamonds', 8),
      card('preview-h7', 'diamonds', 4),
      card('preview-h8', 'clubs', 11),
      card('preview-h9', 'clubs', 3),
    ],
    players: buildPlayers(),
    // Unset, matching an empty chaal — the real game only sets this once the leader plays
    // their first card of the trick.
    status: 'PLAYING',
  };
}

export const PREVIEW_WALLET_BALANCE = 950;
