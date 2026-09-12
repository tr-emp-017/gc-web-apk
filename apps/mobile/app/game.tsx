import { Screen, palette } from '../src/components/Screen';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationBar } from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { PlayingCard, SUIT_SYMBOLS } from '../src/components/PlayingCard';
import { DraggableHand } from '../src/components/DraggableHand';
import { ThrownCard } from '../src/components/ThrownCard';
import { ReactionFlyer } from '../src/components/ReactionFlyer';
import { ProfileModal } from '../src/components/ProfileModal';
import { AvatarFlash } from '../src/components/AvatarFlash';
import { FunSoundPlayback } from '../src/components/FunSoundPlayback';
import { useSound } from '../src/hooks/useSound';
import { AVATAR_IMAGES } from '../src/constants/avatarImages';
import { CRYING_DONKEY_IMAGE } from '../src/constants/gameOverImages';
import { CRYING_FACE_IMAGES } from '../src/constants/cryingFaceImages';
import {
  attachFullscreenUnlockGesture,
  exitWebFullscreenLandscape,
  requestWebFullscreenLandscape,
} from '../src/utils/webFullscreen';

import {
  FUN_SOUND_OPTIONS,
  FUN_SOUND_SYMBOLS,
  REACTION_SYMBOLS,
  type FunSoundId,
  type PublicPlayer,
  type ReactionId,
  type VisibleCard,
} from '@gadha-chor/shared-types';
import { useRoomStore } from '../src/stores/roomStore';
import { useVoice } from '../src/voice/useVoice';

const statusBadgeLabels: Record<'SPECTATING' | 'LEFT', string> = {
  LEFT: 'LEFT',
  SPECTATING: 'WATCHING',
};

type SeatPosition = { readonly x: number; readonly y: number };

type ThrowingCard = {
  readonly card: VisibleCard;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly restRotateDeg: number;
  readonly throwId: string;
  readonly toXPercent: number;
  readonly toYPercent: number;
};

const OPPONENT_SEAT_LAYOUTS: Record<number, readonly SeatPosition[]> = {
  1: [{ x: 50, y: 10 }],
  2: [
    { x: 22, y: 14 },
    { x: 78, y: 14 },
  ],
  3: [
    { x: 8, y: 46 },
    { x: 50, y: 8 },
    { x: 92, y: 46 },
  ],
  4: [
    { x: 8, y: 24 },
    { x: 33, y: 6 },
    { x: 67, y: 6 },
    { x: 92, y: 24 },
  ],
  5: [
    { x: 6, y: 40 },
    { x: 22, y: 8 },
    { x: 50, y: 2 },
    { x: 78, y: 8 },
    { x: 94, y: 40 },
  ],
};

const ME_SEAT: SeatPosition = { x: 50, y: 92 };

// The table fills the whole screen, letterboxed to this aspect ratio — same approach as
// the dev-table-preview route this layout is ported from. A typical phone's landscape
// viewport (after excluding system bars) is considerably more elongated than a standard
// 16:9 shape — as narrow as ~2.5:1 on some devices — so this uses its own wider table image
// (poker-table-native.png, a stretched-middle/untouched-rounded-ends variant of the table so
// nothing looks distorted) at a matching wider ratio, cutting that wasted letterboxing margin
// down substantially across common device aspect ratios without fully eliminating it on any
// single one. Applied identically on web and native so the installed PWA matches the app.
const NATIVE_TABLE_ASPECT_RATIO = 2.4;
// A modest deliberate vertical-only stretch applied on top of the normal contain-fit box
// below, so the table reads as a little taller/more vertically spacious without widening it
// or touching the table image asset itself. Paired with resizeMode "stretch" (see TableWrap)
// so the image actually fills the taller box instead of just adding empty padding above/below
// it. Clamped where it's applied so it can never push the table's top edge above the visible
// screen.
const NATIVE_TABLE_VERTICAL_STRETCH = 1.12;
// A bit more breathing room between hand cards than a tighter default fan spacing would give.
const HAND_OVERLAP_MULTIPLIER_NATIVE = 1.2;
// Small deliberate gap between the hand's bottom edge and the true screen edge — enough to
// avoid looking pasted flush against the bezel, not enough to reintroduce a large dead margin.
const HAND_BOTTOM_MARGIN_NATIVE_PX = 20;
// Web-only: reserves real, guaranteed empty space at the very bottom of the browser
// viewport itself (shrinking the table's own available height), rather than trying to
// position the hand further from the table's bottom edge — the table's bottom edge is
// always pinned to the full viewport's bottom edge by construction, so nudging the hand's
// own offset alone never actually reveals more space below it on web. Change this value to
// adjust the web-only bottom margin under the hand.
const HAND_BOTTOM_MARGIN_WEB_PX = 20;
// Table/thrown/discard-pile cards are rendered at "played" size and visually scaled up —
// scaling is centered on each card's own box, so none of the position/centering math below
// needs to change to account for it.
const TABLE_CARD_SCALE = 1.4;
// Base (responsiveScale === 1) profile sizing — large, clearly-visible circular avatars with
// consistent spacing to the name/turn indicator below them, matching every seat. Scaled by
// responsiveScale below so it shrinks proportionally on a smaller table instead of dominating
// it, then bumped further by NATIVE_AVATAR_SIZE_MULTIPLIER since profiles read better large.
const AVATAR_SIZE_PX = 85;
const SEAT_LABEL_WIDTH_PX = 132;
const NATIVE_AVATAR_SIZE_MULTIPLIER = 1.4;
// The topmost seat row (e.g. the 5-opponent layout's dead-center-top seat at y: 2) sits close
// enough to the table's own top edge that the larger avatar above visually overlaps it.
// Clamping every opponent seat's y to at least this percent nudges only the seats that are
// already near the top down a little, leaving every other seat (and every x position) exactly
// where it was.
const NATIVE_MIN_OPPONENT_SEAT_Y_PERCENT = 14;
// The hand's fan is allowed to use this fraction of the felt's width before its overlap
// starts tightening up — leaves a little breathing room on either side.
const HAND_WIDTH_BUDGET_FRACTION = 0.92;
// Card sizing (TABLE_CARD_SCALE, HAND_CARD_SCALE, and every raw-pixel gap below) was tuned
// against a table this wide. A smaller table scales everything down proportionally instead
// of holding a fixed pixel size that dominates a small screen; never scales up past 1, so a
// very wide screen doesn't blow the cards up either.
const RESPONSIVE_SCALE_REFERENCE_WIDTH_PX = 1400;
const MIN_RESPONSIVE_SCALE = 0.5;

// Played cards lay out as a flat horizontal row across the middle of the felt, in play
// order, instead of scattering toward each player's seat — easier to read at a glance.
const TABLE_CARD_ROW_GAP_PX = 95;
const TABLE_CARD_ROW_Y_PERCENT = 46;
// Where finished tricks collect, face-down, like a real discard pile — always the same
// spot (bottom-right edge of the felt), regardless of who won the trick.
const DISCARD_PILE_X_PERCENT = 82;
const DISCARD_PILE_Y_PERCENT = 64;
const DISCARD_PILE_VISIBLE_DEPTH = 5;
// How long a finished trick sits still (winning card highlighted) before it's swept up,
// and how long that sweep-to-the-discard-pile animation takes.
const TRICK_HOLD_MS = 2000;
const TRICK_COLLECT_MS = 550;
// An Inaam briefly gathers every card from that chaal in the center before sweeping them
// all toward whoever receives them — shorter than the regular trick hold since there's no
// winning card to read, just a quick "here's what's being handed over" beat.
const INAAM_GATHER_HOLD_MS = 650;
const INAAM_SWEEP_DURATION_MS = 900;
// Fraction of the sweep's timeline spent staggering each card's start — later cards begin
// later but all finish together, reading as "collected one after another".
const INAAM_STAGGER_FRACTION = 0.35;
// A "take all cards" transfer flies face-down, staggered, straight from the giver's seat
// to the requester's seat — no gathering phase since it's a direct hand-to-hand move, not
// a completed trick.
const TRANSFER_SWEEP_DURATION_MS = 800;
const TRANSFER_STAGGER_FRACTION = 0.4;
// Cap how many individual card sprites fly for a big hand — the count badge still shows
// the true number, this just keeps a 15+ card hand from rendering 15+ animated sprites.
const TRANSFER_VISIBLE_CARD_CAP = 8;

// Where the i-th of `total` played cards sits in the flat horizontal row across the
// middle of the felt, as a percent of the table box — flat and non-rotated, matching the
// reference layout, instead of scattering each card toward its player's seat. `gapPx` is
// TABLE_CARD_ROW_GAP_PX pre-multiplied by the table's responsive scale.
function rowPosition(index: number, total: number, tableWidthPx: number, gapPx: number): SeatPosition {
  const gapPercent = tableWidthPx > 0 ? (gapPx / tableWidthPx) * 100 : 9;
  const offsetPercent = (index - (total - 1) / 2) * gapPercent;
  return { x: 50 + offsetPercent, y: TABLE_CARD_ROW_Y_PERCENT };
}

// Same table render (poker-table-native.png, transparent background) and "stretch" resize on
// every platform, so the installed web PWA looks identical to the native app — the box below
// is sized to exactly match the image's own aspect ratio horizontally, then deliberately
// inflated a little vertically (NATIVE_TABLE_VERTICAL_STRETCH), so "stretch" only ever
// distorts that same small vertical amount rather than cropping or padding the table.
function TableWrap({
  children,
  onLayout,
  style,
  tableImageStyle,
}: {
  readonly children: React.ReactNode;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
  readonly style: StyleProp<ViewStyle>;
  readonly tableImageStyle: StyleProp<ImageStyle>;
}): React.JSX.Element {
  return (
    <ImageBackground
      imageStyle={tableImageStyle}
      onLayout={onLayout}
      // "stretch" is what actually makes the deliberate vertical stretch above
      // (renderedBoxHeight in game.tsx) visible — "contain" would just add empty padding
      // above/below the image inside the taller box instead of enlarging it. Since the box's
      // width is untouched and only its height is inflated, this only stretches vertically.
      resizeMode="stretch"
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
      source={require('../assets/poker-table-native.png')}
      style={style}
    >
      {children}
    </ImageBackground>
  );
}

// RN's own `useWindowDimensions()` didn't reliably pick up the post-rotation size on
// Android/Expo Go after `ScreenOrientation.lockAsync` programmatically rotates the device
// (as opposed to the user physically turning the phone) — the table kept rendering at the
// stale, pre-rotation (portrait) size. This re-reads `Dimensions.get('window')` on every
// signal that could mean the layout changed: the standard dimensions-change event, AND every
// `expo-screen-orientation` orientation-change event, which fires reliably once the OS-level
// rotation this screen requested has actually completed.
function useLiveWindowSize(): { readonly width: number; readonly height: number } {
  const [size, setSize] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const sync = (): void => setSize(Dimensions.get('window'));
    const dimensionsSubscription = Dimensions.addEventListener('change', sync);
    const orientationSubscription =
      Platform.OS === 'web' ? null : ScreenOrientation.addOrientationChangeListener(sync);
    return () => {
      dimensionsSubscription.remove();
      orientationSubscription?.remove();
    };
  }, []);

  return size;
}

export default function GameTableScreen(): React.JSX.Element {
  const router = useRouter();
  const room = useRoomStore((state) => state.room);
  const gameState = useRoomStore((state) => state.gameState);
  const playerId = useRoomStore((state) => state.playerId);
  const previewMode = useRoomStore((state) => state.previewMode);
  const botMode = useRoomStore((state) => state.botMode);
  const playCard = useRoomStore((state) => state.playCard);
  const reactToPlayer = useRoomStore((state) => state.reactToPlayer);
  const latestReaction = useRoomStore((state) => state.latestReaction);
  const walletBalance = useRoomStore((state) => state.walletBalance);
  const leaveGame = useRoomStore((state) => state.leaveGame);
  const spectateGame = useRoomStore((state) => state.spectateGame);
  const playAgain = useRoomStore((state) => state.playAgain);
  const exitGame = useRoomStore((state) => state.exitGame);
  const returnHome = useRoomStore((state) => state.returnHome);
  const error = useRoomStore((state) => state.error);
  const lastCompletedChaal = useRoomStore((state) => state.lastCompletedChaal);
  const clearLastCompletedChaal = useRoomStore((state) => state.clearLastCompletedChaal);
  const incomingTransferRequest = useRoomStore((state) => state.incomingTransferRequest);
  const transferResolution = useRoomStore((state) => state.transferResolution);
  const clearTransferResolution = useRoomStore((state) => state.clearTransferResolution);
  const requestCardTransfer = useRoomStore((state) => state.requestCardTransfer);
  const respondCardTransfer = useRoomStore((state) => state.respondCardTransfer);
  const lastInaam = useRoomStore((state) => state.lastInaam);
  const clearLastInaam = useRoomStore((state) => state.clearLastInaam);
  const lastFunSound = useRoomStore((state) => state.lastFunSound);
  const playFunSound = useRoomStore((state) => state.playFunSound);
  const { isMuted, isSpeakerEnabled, toggleMuted, toggleSpeaker, unavailable } = useVoice();
  const liveWindowSize = useLiveWindowSize();
  // The root viewport below measures its OWN actual laid-out size via onLayout — that's the
  // authoritative source once available, since it reflects a real completed native layout
  // pass rather than a polled API. On this Android/Expo Go combo, even the dimensions-change
  // + orientation-change listeners in useLiveWindowSize sometimes settle on a stale
  // pre-rotation size after a *programmatic* (ScreenOrientation.lockAsync-driven) rotation;
  // onLayout doesn't have that failure mode. useLiveWindowSize only covers the brief instant
  // before the first layout pass reports in.
  const [measuredViewport, setMeasuredViewport] = useState({ height: 0, width: 0 });
  const winWidth = measuredViewport.width > 0 ? measuredViewport.width : liveWindowSize.width;
  const winHeight = measuredViewport.height > 0 ? measuredViewport.height : liveWindowSize.height;
  // This doesn't exclude the status bar / gesture-nav areas, which the table box below must
  // avoid so the table and its buttons never end up drawn underneath system UI.
  const insets = useSafeAreaInsets();
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isStartingRematch, setIsStartingRematch] = useState(false);
  const [suitSortSignal, setSuitSortSignal] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingTransferTargetId, setPendingTransferTargetId] = useState<string | null>(null);
  // Reactions thrown from the profile modal: every connected client (sender, target, and
  // bystanders alike) gets the same 'player:reacted' broadcast and renders the same flight,
  // so everyone sees the same throw land in the same place.
  const [reactionFlights, setReactionFlights] = useState<
    readonly {
      readonly id: string;
      readonly reaction: ReactionId;
      readonly fromPlayerId: string;
      readonly targetPlayerId: string;
    }[]
  >([]);
  // latestReaction is a fresh object reference every time the store receives one, even for an
  // identical reaction sent twice in a row — comparing by reference (not by field equality)
  // against the last one this effect has already turned into a flight is what lets repeated
  // identical reactions each still trigger their own throw.
  const handledReactionRef = useRef<typeof latestReaction>(null);
  // The bottom-left soundboard: any player can play one of these for the whole room, and the
  // player's own profile flashes wherever their seat is (opponent seat or the "You" label) for
  // as long as the sound plays. Same broadcast-to-everyone, dedupe-by-reference pattern as
  // reactions above.
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [funSoundFlashes, setFunSoundFlashes] = useState<
    readonly { readonly id: string; readonly playerId: string; readonly soundId: FunSoundId }[]
  >([]);
  const handledFunSoundRef = useRef<typeof lastFunSound>(null);
  const funSoundFlashPlayerIds = new Set(funSoundFlashes.map((flash) => flash.playerId));
  // Only one soundboard clip plays for the whole room at a time — every sound button is
  // disabled (for every player) while any of them is still playing, then all re-enable
  // together the instant it finishes.
  const isAnySoundPlaying = funSoundFlashes.length > 0;

  // Force landscape the moment this screen mounts (entering the game), and hand
  // orientation control back the moment it unmounts (leaving the game) — the lobby/home
  // screens, and the app as a whole, are never touched. Native-only: app.json's top-level
  // "orientation" is "default" (unrestricted) specifically so this per-screen lock can take
  // effect on iOS, which otherwise enforces the manifest-level setting as a hard cap.
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      // Lock back to portrait (the app's original, app.json-level default for every other
      // screen) rather than a bare unlockAsync(), which would leave free rotation active —
      // the lobby/home screens were never designed for landscape.
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);
  // Web equivalent of the native lock above: requests fullscreen (what actually hides
  // Chrome's address bar) and, once granted, locks to landscape. Browsers only grant
  // requestFullscreen() from a genuine user gesture, so this both tries eagerly on mount
  // (works if navigating here was itself a tap) and falls back to the very first tap
  // anywhere on the game screen if that eager attempt was blocked — no separate "rotate your
  // device" prompt is ever shown, this is purely best-effort browser API use. Desktop web
  // (mouse-driven, not a phone) is unaffected either way: fullscreen there just means the
  // existing layout fills the whole window, and orientation lock is a no-op without a
  // rotatable screen.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    requestWebFullscreenLandscape();
    const detachGesture = attachFullscreenUnlockGesture();
    return () => {
      detachGesture();
      exitWebFullscreenLandscape();
    };
  }, []);
  // Null-safe stand-in for isMyTurn (computed properly below, once gameState is narrowed
  // non-null) — needed here because hooks must run unconditionally, before either early
  // return below.
  const isMyTurnForSound = gameState?.currentPlayerId === playerId;
  const opponents = gameState?.players.filter((player) => player.id !== playerId) ?? [];
  // opponents[0] is whoever plays right after you (removing yourself from the turn cycle
  // preserves everyone else's relative order) — seat them starting from your RIGHT and
  // working around to your left, so the turn visibly progresses right-to-left.
  const seatFor = (player: PublicPlayer): SeatPosition => {
    if (player.id === playerId) {
      return ME_SEAT;
    }
    const index = opponents.findIndex((opponent) => opponent.id === player.id);
    const layout = OPPONENT_SEAT_LAYOUTS[opponents.length] ?? OPPONENT_SEAT_LAYOUTS[5];
    const seatIndex = layout !== undefined ? layout.length - 1 - index : index;
    const position = layout?.[seatIndex] ?? { x: 50, y: 10 };
    return { x: position.x, y: Math.max(position.y, NATIVE_MIN_OPPONENT_SEAT_Y_PERCENT) };
  };

  // The table fills the safe area — letterboxed to TABLE_ASPECT_RATIO and centered within
  // whatever space is left after excluding the status bar / notch / gesture-nav insets
  // (all zero on web), rather than the full raw window. The outer viewport itself still
  // spans the full window so its background bleeds edge-to-edge behind the system bars.
  const availableWidth = winWidth - insets.left - insets.right;
  const availableHeight = winHeight - insets.top - insets.bottom;
  const tableAspectRatio = NATIVE_TABLE_ASPECT_RATIO;
  let boxWidth = availableWidth;
  let boxHeight = boxWidth / tableAspectRatio;
  if (boxHeight > availableHeight) {
    boxHeight = availableHeight;
    boxWidth = boxHeight * tableAspectRatio;
  }
  // boxWidth stays exactly as computed above (no sideways stretch). boxHeight gets a modest
  // vertical-only bump, capped so the table's top edge can never rise above the physical
  // screen (insets.top + availableHeight is the same quantity tableTopPx's bottom-anchor
  // below is measured from).
  const renderedBoxHeight = Math.min(
    boxHeight * NATIVE_TABLE_VERTICAL_STRETCH,
    insets.top + availableHeight,
  );
  // Card sizing scales down proportionally on a smaller table instead of holding a fixed
  // pixel size that dominates a small screen.
  const responsiveScale = Math.max(
    MIN_RESPONSIVE_SCALE,
    Math.min(1, boxWidth / RESPONSIVE_SCALE_REFERENCE_WIDTH_PX),
  );
  const tableCardRowGapPx = TABLE_CARD_ROW_GAP_PX * responsiveScale;
  const tableCardTransformStyle = { transform: [{ scale: TABLE_CARD_SCALE * responsiveScale }] };
  // Large, clearly-visible circular avatars — sized relative to the table (like every other
  // seat/card measurement here) so they scale together with it instead of dominating a small
  // table or looking tiny on a large one, plus a further deliberate bump; the seat label and
  // its text scale the same way so the username and TURN indicator stay aligned with the
  // bigger avatar.
  const avatarSizePx = AVATAR_SIZE_PX * responsiveScale * NATIVE_AVATAR_SIZE_MULTIPLIER;
  const seatLabelWidthPx = SEAT_LABEL_WIDTH_PX * responsiveScale * NATIVE_AVATAR_SIZE_MULTIPLIER;
  const avatarSizeStyle = { borderRadius: avatarSizePx / 2, height: avatarSizePx, width: avatarSizePx };
  const seatSizeStyle = {
    marginLeft: -seatLabelWidthPx / 2,
    marginTop: -avatarSizePx / 2,
    width: seatLabelWidthPx,
  };
  const playerNameSizeStyle = { fontSize: 18 * responsiveScale, maxWidth: seatLabelWidthPx };

  // Measured once the felt is actually laid out, so seat/throw positions (given in
  // percent) can be converted to real pixel deltas for the throw animation below.
  const [tableSize, setTableSize] = useState({ height: 0, width: 0 });
  // Cards that are still mid-throw animation — rendered via ThrownCard instead of the
  // plain static PlayingCard until each one finishes landing.
  const [throwingCards, setThrowingCards] = useState<readonly ThrowingCard[]>([]);
  // How many cards were in the current chaal last time we looked — lets us detect
  // exactly which entries are brand new without depending on ever-unique card ids (a
  // physical card's id repeats across chaals within the same game).
  const previousChaalLengthRef = useRef(0);
  // The chaal-completing card is never visible in gameState.currentChaal — the server
  // clears the trick internally in the same instant it collects the winning card, so the
  // client only ever sees the trick jump straight from N-1 cards to 0. This ref remembers
  // the throwId of the synthetic ThrownCard created for that finishing card (below), so
  // removeThrowingCard can trigger the hold/highlight/collect sequence exactly when it lands.
  const pendingChaalFreezeRef = useRef<{
    readonly throwId: string;
    readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
    readonly winnerId: string;
  } | null>(null);
  const [frozenTrick, setFrozenTrick] = useState<{
    readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
    readonly winnerId: string;
  } | null>(null);
  // The trick's already-landed cards, kept on screen while the finishing card is still
  // flying in — otherwise they'd vanish the instant the server's now-empty state arrives,
  // popping back only once frozenTrick takes over when the throw lands. `total` is the
  // full trick size (including the still-flying card), so the row layout of these already-
  // landed cards doesn't shift once frozenTrick takes over with the complete list.
  const [finishingTrick, setFinishingTrick] = useState<{
    readonly restCards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
    readonly total: number;
  } | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [discardPile, setDiscardPile] = useState<readonly VisibleCard[]>([]);
  const collectAnim = useRef(new Animated.Value(0)).current;

  // An Inaam's finishing (gift) card has the exact same "invisible in gameState.currentChaal"
  // problem as a regular chaal-completing card — the server folds it into the receiver's hand
  // in the same instant it clears the trick. `phase` walks through: 'finishing' (the gift card
  // is still flying in from the giver's seat, same as any other throw) → 'gathering' (the whole
  // chaal briefly sits together in the center) → 'sweeping' (all of it travels to the receiver).
  const pendingInaamThrowIdRef = useRef<string | null>(null);
  const [inaamAnimation, setInaamAnimation] = useState<{
    readonly cards: readonly { readonly playerId: string; readonly card: VisibleCard }[];
    readonly receiverId: string;
    readonly phase: 'finishing' | 'gathering' | 'sweeping';
  } | null>(null);
  const inaamSweepAnim = useRef(new Animated.Value(0)).current;
  // While an Inaam is animating, the receiver's hand/seat count must not visibly change
  // until the sweep lands — even though the server (and therefore gameState) already
  // reflects the transfer the instant the event arrives.
  const inaamCardIdsInFlight =
    inaamAnimation !== null ? new Set(inaamAnimation.cards.map((play) => play.card.id)) : null;

  // A "take all cards" transfer: cards fly face-down straight from the giver's seat to the
  // requester's — the giver's hand and the requester's own hand/seat count must stay at
  // their pre-transfer values until this lands, even though gameState already reflects it.
  // `targetPreviousOwnCards` only applies when the viewer IS the giver (their own hand
  // display can't be reconstructed from a count alone the way an opponent's card-back fan can).
  const [transferAnimation, setTransferAnimation] = useState<{
    readonly requesterId: string;
    readonly targetId: string;
    readonly cardCount: number;
    readonly targetPreviousOwnCards: readonly VisibleCard[] | null;
  } | null>(null);
  const transferSweepAnim = useRef(new Animated.Value(0)).current;

  /* eslint-disable @typescript-eslint/no-require-imports -- static asset requires */
  const playTurnSound = useSound(require('../assets/turn-sound.mp3'));
  const playThrowSound = useSound(require('../assets/throw-sound.mp3'));
  const playCollectSound = useSound(require('../assets/collect-sound.mp3'));
  /* eslint-enable @typescript-eslint/no-require-imports */

  // A resolved transfer (accepted or declined) clears whichever local "asking..." indicator
  // is showing — the requester learns the outcome this way, since gameState itself already
  // reflects an accepted transfer (the target's hand/status change) once it arrives. This
  // event is guaranteed to arrive before the corresponding game:state update (the server
  // emits it first), so `gameState` here is still the pre-transfer snapshot — safe to read
  // for the giver's about-to-vanish hand.
  useEffect(() => {
    if (transferResolution === null) {
      return;
    }
    if (transferResolution.requesterId === playerId) {
      setPendingTransferTargetId(null);
    }
    if (transferResolution.accepted && transferResolution.cardCount > 0 && tableSize.width > 0) {
      setTransferAnimation({
        cardCount: transferResolution.cardCount,
        requesterId: transferResolution.requesterId,
        targetId: transferResolution.targetId,
        targetPreviousOwnCards:
          transferResolution.targetId === playerId ? (gameState?.ownCards ?? []) : null,
      });
      playCollectSound();
      if (Platform.OS !== 'web') {
        Vibration.vibrate(30);
      }
      Animated.timing(transferSweepAnim, {
        duration: TRANSFER_SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }).start(() => {
        setTransferAnimation(null);
        transferSweepAnim.setValue(0);
      });
    }
    clearTransferResolution();
  }, [
    transferResolution,
    playerId,
    clearTransferResolution,
    gameState?.ownCards,
    tableSize.width,
    playCollectSound,
    transferSweepAnim,
  ]);

  // Turns the store's latestReaction (also used for the small top-right toast) into a flying
  // reaction: everyone in the room gets the same broadcast, so this fires identically on the
  // sender's, the target's, and every bystander's screen.
  useEffect(() => {
    if (latestReaction === null || handledReactionRef.current === latestReaction) {
      return;
    }
    handledReactionRef.current = latestReaction;
    if (tableSize.width === 0) {
      return;
    }
    setReactionFlights((current) => [
      ...current,
      {
        fromPlayerId: latestReaction.fromPlayerId,
        id: `${latestReaction.fromPlayerId}-${latestReaction.targetPlayerId}-${current.length}-${Date.now()}`,
        reaction: latestReaction.reaction,
        targetPlayerId: latestReaction.targetPlayerId,
      },
    ]);
  }, [latestReaction, tableSize.width]);

  function removeReactionFlight(id: string): void {
    setReactionFlights((current) => current.filter((flight) => flight.id !== id));
  }

  // Same dedupe-by-reference idea as latestReaction above, for the soundboard.
  useEffect(() => {
    if (lastFunSound === null || handledFunSoundRef.current === lastFunSound) {
      return;
    }
    handledFunSoundRef.current = lastFunSound;
    setFunSoundFlashes((current) => [
      ...current,
      {
        id: `${lastFunSound.playerId}-${current.length}-${Date.now()}`,
        playerId: lastFunSound.playerId,
        soundId: lastFunSound.soundId,
      },
    ]);
  }, [lastFunSound]);

  function removeFunSoundFlash(id: string): void {
    setFunSoundFlashes((current) => current.filter((flash) => flash.id !== id));
  }

  // Play the alert sound and vibrate the device the moment it becomes your turn — not on
  // every render while it stays your turn, just the instant it changes.
  useEffect(() => {
    if (!isMyTurnForSound) {
      return;
    }
    playTurnSound();
    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }
  }, [isMyTurnForSound, playTurnSound]);

  useEffect(() => {
    const chaal = gameState?.currentChaal ?? [];
    const previousLength = previousChaalLengthRef.current;
    if (chaal.length > previousLength && tableSize.width > 0) {
      const newlyPlayed = chaal.slice(previousLength);
      playThrowSound();
      setThrowingCards((current) => [
        ...current,
        ...newlyPlayed.map((playedCard, index) => {
          const player = gameState?.players.find((candidate) => candidate.id === playedCard.playerId);
          const seat = player !== undefined ? seatFor(player) : ME_SEAT;
          const rowIndex = previousLength + index;
          const rowTotal = chaal.length;
          const rest = rowPosition(rowIndex, rowTotal, tableSize.width, tableCardRowGapPx);
          return {
            card: playedCard.card,
            deltaX: ((seat.x - rest.x) / 100) * tableSize.width,
            deltaY: ((seat.y - rest.y) / 100) * tableSize.height,
            restRotateDeg: 0,
            throwId: `${playedCard.playerId}-${rowIndex}`,
            toXPercent: rest.x,
            toYPercent: rest.y,
          };
        }),
      ]);
    }
    previousChaalLengthRef.current = chaal.length;
  }, [gameState?.currentChaal, gameState?.players, tableSize.height, tableSize.width, playThrowSound]);

  // The server tells us a chaal just finished (with every card it held, including the
  // finishing one we'd otherwise never see) via 'chaal:completed'. Animate that finishing
  // card flying in from its player's seat same as any other play, then once it lands, hold
  // the full trick highlighted before sweeping it into the discard pile.
  useEffect(() => {
    if (lastCompletedChaal === null || tableSize.width === 0) {
      return;
    }
    const finishing = lastCompletedChaal.cards[lastCompletedChaal.cards.length - 1];
    if (finishing === undefined) {
      clearLastCompletedChaal();
      return;
    }
    const player = gameState?.players.find((candidate) => candidate.id === finishing.playerId);
    const seat = player !== undefined ? seatFor(player) : ME_SEAT;
    const rowIndex = lastCompletedChaal.cards.length - 1;
    const rowTotal = lastCompletedChaal.cards.length;
    const rest = rowPosition(rowIndex, rowTotal, tableSize.width, tableCardRowGapPx);
    const throwId = `completed-${finishing.playerId}-${finishing.card.id}`;
    playThrowSound();
    pendingChaalFreezeRef.current = {
      cards: lastCompletedChaal.cards,
      throwId,
      winnerId: lastCompletedChaal.winnerId,
    };
    setFinishingTrick({
      restCards: lastCompletedChaal.cards.slice(0, -1),
      total: lastCompletedChaal.cards.length,
    });
    setThrowingCards((current) => [
      ...current,
      {
        card: finishing.card,
        deltaX: ((seat.x - rest.x) / 100) * tableSize.width,
        deltaY: ((seat.y - rest.y) / 100) * tableSize.height,
        restRotateDeg: 0,
        throwId,
        toXPercent: rest.x,
        toYPercent: rest.y,
      },
    ]);
    clearLastCompletedChaal();
  }, [
    lastCompletedChaal,
    tableSize.width,
    tableSize.height,
    gameState?.players,
    clearLastCompletedChaal,
    playThrowSound,
  ]);

  // Same "invisible finishing card" gap as a regular chaal win, but for an Inaam: animate
  // the gift card flying in like any other throw, then (once it lands) gather the whole
  // chaal in the center for a beat before sweeping it all toward whoever receives it.
  useEffect(() => {
    if (lastInaam === null || tableSize.width === 0) {
      return;
    }
    const finishing = lastInaam.cards[lastInaam.cards.length - 1];
    if (finishing === undefined) {
      clearLastInaam();
      return;
    }
    const player = gameState?.players.find((candidate) => candidate.id === finishing.playerId);
    const seat = player !== undefined ? seatFor(player) : ME_SEAT;
    const rowIndex = lastInaam.cards.length - 1;
    const rowTotal = lastInaam.cards.length;
    const rest = rowPosition(rowIndex, rowTotal, tableSize.width, tableCardRowGapPx);
    const throwId = `inaam-${finishing.playerId}-${finishing.card.id}`;
    playThrowSound();
    pendingInaamThrowIdRef.current = throwId;
    setInaamAnimation({ cards: lastInaam.cards, phase: 'finishing', receiverId: lastInaam.receiverId });
    setThrowingCards((current) => [
      ...current,
      {
        card: finishing.card,
        deltaX: ((seat.x - rest.x) / 100) * tableSize.width,
        deltaY: ((seat.y - rest.y) / 100) * tableSize.height,
        restRotateDeg: 0,
        throwId,
        toXPercent: rest.x,
        toYPercent: rest.y,
      },
    ]);
    clearLastInaam();
  }, [lastInaam, tableSize.width, tableSize.height, gameState?.players, clearLastInaam, playThrowSound]);

  // Once the gift card lands, hold the whole chaal together briefly, then sweep every card
  // toward the receiver's actual seat — staggered so they read as collected one at a time.
  useEffect(() => {
    if (inaamAnimation === null || inaamAnimation.phase !== 'gathering') {
      return;
    }
    const holdTimer = setTimeout(() => {
      setInaamAnimation((current) => (current !== null ? { ...current, phase: 'sweeping' } : null));
      playCollectSound();
      if (Platform.OS !== 'web') {
        Vibration.vibrate(30);
      }
      Animated.timing(inaamSweepAnim, {
        duration: INAAM_SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }).start(() => {
        setInaamAnimation(null);
        inaamSweepAnim.setValue(0);
      });
    }, INAAM_GATHER_HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [inaamAnimation, inaamSweepAnim, playCollectSound]);

  useEffect(() => {
    if (frozenTrick === null) {
      return;
    }
    const holdTimer = setTimeout(() => {
      setIsCollecting(true);
      playCollectSound();
      Animated.timing(collectAnim, {
        duration: TRICK_COLLECT_MS,
        toValue: 1,
        useNativeDriver: true,
      }).start(() => {
        setDiscardPile((current) => [...current, ...frozenTrick.cards.map(({ card }) => card)]);
        setFrozenTrick(null);
        setIsCollecting(false);
        collectAnim.setValue(0);
      });
    }, TRICK_HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [frozenTrick, collectAnim, playCollectSound]);

  function removeThrowingCard(throwId: string): void {
    setThrowingCards((current) => current.filter((entry) => entry.throwId !== throwId));
    const pending = pendingChaalFreezeRef.current;
    if (pending !== null && pending.throwId === throwId) {
      pendingChaalFreezeRef.current = null;
      setFinishingTrick(null);
      setFrozenTrick({ cards: pending.cards, winnerId: pending.winnerId });
      return;
    }
    if (pendingInaamThrowIdRef.current === throwId) {
      pendingInaamThrowIdRef.current = null;
      setInaamAnimation((current) => (current !== null ? { ...current, phase: 'gathering' } : null));
    }
  }

  // Once anyone in the room presses "Play again", the server resets everyone's room back to
  // 'LOBBY' and roomStore drops the now-stale (finished) gameState to null in response — this
  // is what sends every player still sitting on this screen (not just whoever pressed the
  // button) back to the lobby to ready up for the next match.
  useEffect(() => {
    if (!previewMode && !botMode && gameState === null && room !== null && room.status === 'LOBBY') {
      router.replace(`/room/${room.code}`);
    }
  }, [gameState, room, previewMode, botMode, router]);

  if (gameState === null) {
    return (
      <Screen>
        <Text style={styles.title}>Waiting for the table</Text>
        <Text style={styles.muted}>The server has not sent a game state yet.</Text>
      </Screen>
    );
  }

  if (gameState.status === 'GAME_OVER') {
    const gadhaChor = gameState.players.find((player) => player.id === gameState.gadhaChorId);
    // Exactly one player ends the game as the Gadha Chor — every other player, by definition,
    // finished (emptied their hand) before that happened, so they're the winners.
    const winners = gameState.players.filter((player) => player.id !== gameState.gadhaChorId);
    const goHome = (): void => {
      returnHome();
      router.replace('/');
    };
    return (
      <View style={styles.gameOverBackdrop}>
        <ScrollView contentContainerStyle={styles.gameOverScrollContent}>
          <View style={styles.gameOverCard}>
            <Pressable
              accessibilityLabel="Back to home"
              accessibilityRole="button"
              onPress={goHome}
              style={styles.gameOverCloseButton}
            >
              <Ionicons color={palette.white} name="close" size={20} />
            </Pressable>

            <Text style={styles.eyebrow}>GAME OVER</Text>
            <Text style={styles.title}>
              {gadhaChor?.id === playerId
                ? 'You are the Gadha Chor'
                : `${gadhaChor?.name ?? 'A player'} is the Gadha Chor`}
            </Text>

            <View style={styles.resultColumns}>
              <View style={styles.resultColumn}>
                <Text style={styles.resultColumnHeading}>WINNERS</Text>
                {winners.map((player) => (
                  <View key={player.id} style={styles.resultPlayerRow}>
                    <View style={styles.resultAvatar}>
                      <Image
                        resizeMode="cover"
                        source={AVATAR_IMAGES[player.avatar]}
                        style={styles.resultAvatarImage}
                      />
                    </View>
                    <Text numberOfLines={1} style={styles.resultPlayerName}>
                      {player.id === playerId ? 'You' : player.name}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.resultColumn, styles.loserColumn]}>
                <Text style={styles.resultColumnHeading}>LOSER</Text>
                {gadhaChor !== undefined && (
                  <View style={styles.resultPlayerRow}>
                    <View style={[styles.resultAvatar, styles.loserAvatar]}>
                      {/* The loser's own crying-face variant, not their normal happy avatar. */}
                      <Image
                        resizeMode="cover"
                        source={CRYING_FACE_IMAGES[gadhaChor.avatar]}
                        style={styles.resultAvatarImage}
                      />
                    </View>
                    <Text numberOfLines={1} style={styles.resultPlayerName}>
                      {gadhaChor.id === playerId ? 'You' : gadhaChor.name}
                    </Text>
                  </View>
                )}
                <Image
                  resizeMode="contain"
                  source={CRYING_DONKEY_IMAGE}
                  style={styles.cryingDonkeyImage}
                />
              </View>
            </View>

            {walletBalance !== null && (
              <Text style={styles.muted}>Your balance: {walletBalance} coins</Text>
            )}
            <View style={styles.actions}>
              <PrimaryButton
                label={isStartingRematch ? 'Starting…' : 'Play again'}
                onPress={() => {
                  setIsStartingRematch(true);
                  // No explicit navigation here — the effect above sends every player (not
                  // just whoever pressed this) back to the lobby once the server confirms the
                  // reset, via room:updated clearing gameState. In preview mode, playAgain()
                  // instead regenerates a fresh mock match in place, so there's nothing to
                  // navigate to.
                  void playAgain().then(() => setIsStartingRematch(false));
                }}
              />
              <PrimaryButton label="Back to home" onPress={goHome} variant="secondary" />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const showPostGameChoice = myPlayer?.status === 'FINISHED';
  const isMyTurn = gameState.currentPlayerId === playerId;
  // Requesting someone's whole hand only makes sense while leading a fresh chaal on your
  // own turn (matches the server-side rule in RoomManager), and — since the requester ends
  // up as the sole active player and an instant Gadha Chor if it drops the game to 1 — only
  // while at least 3 players are still active. The server re-validates both independently.
  const activePlayerCount = gameState.players.filter((player) => player.status === 'ACTIVE').length;
  const canRequestCardTransfer =
    isMyTurn &&
    !gameState.firstMovePending &&
    gameState.currentChaal.length === 0 &&
    activePlayerCount >= 3 &&
    pendingTransferTargetId === null;
  // The profile modal only ever opens for an opponent's seat (see the Pressable in
  // opponents.map below), never for the local player.
  const profileModalPlayer = gameState.players.find((player) => player.id === reactionTargetId) ?? null;
  const canRequestFromProfileModalPlayer =
    profileModalPlayer !== null &&
    canRequestCardTransfer &&
    profileModalPlayer.status === 'ACTIVE';
  // Cards an Inaam is currently carrying to you must stay out of your hand's display (and
  // its width math) until the sweep animation actually lands them, even though the server
  // state has already added them. Same idea for a "take all cards" transfer: the giver keeps
  // seeing their own about-to-vanish hand, and the requester's own hand holds back the last
  // `cardCount` entries (freshly transferred cards are appended, per DraggableHand's own
  // reconciliation) until the sweep lands.
  const visibleOwnCards = (() => {
    if (inaamCardIdsInFlight !== null && inaamAnimation?.receiverId === playerId) {
      return gameState.ownCards.filter((card) => !inaamCardIdsInFlight.has(card.id));
    }
    if (transferAnimation !== null) {
      if (transferAnimation.targetId === playerId && transferAnimation.targetPreviousOwnCards !== null) {
        return transferAnimation.targetPreviousOwnCards;
      }
      if (transferAnimation.requesterId === playerId) {
        return gameState.ownCards.slice(
          0,
          Math.max(0, gameState.ownCards.length - transferAnimation.cardCount),
        );
      }
    }
    return gameState.ownCards;
  })();

  function handleExitTable(): void {
    const action = myPlayer?.status === 'ACTIVE' ? exitGame : leaveGame;
    void action().finally(() => router.replace('/'));
  }

  const handAvailableWidthPx = tableSize.width * HAND_WIDTH_BUDGET_FRACTION;
  // The table's own bottom edge touches the bottom of the safe area (the true screen edge,
  // now that the status/nav bars are hidden).
  const tableTopPx = insets.top + availableHeight - renderedBoxHeight;
  // The hand is anchored inside the table's own coordinate space (so its width/centering
  // still track the table), pulled up from the table's own bottom edge by a small deliberate
  // margin so it doesn't look pasted flush against it — table size/position is unaffected,
  // only the hand's own offset changes. Web gets its own (larger) value, independently
  // tunable from the native one.
  const handBottomGapPx = Platform.OS === 'web' ? HAND_BOTTOM_MARGIN_WEB_PX : HAND_BOTTOM_MARGIN_NATIVE_PX;
  // Where the soundboard button actually sits on the real screen (not just within the table's
  // own coordinate space), so the Modal-based popup below can anchor near it despite living in
  // its own top-level window rather than TableWrap's view tree.
  const soundboardPanelLeftPx = insets.left + (availableWidth - boxWidth) / 2 + 18;
  const soundboardPanelBottomPx = winHeight - (tableTopPx + renderedBoxHeight) + 14;
  // Same reasoning for the settings panel: it renders in a real Modal (its own top-level
  // window, guaranteed to draw above every other on-screen element, including the table/cards)
  // rather than an absolutely-positioned sibling view, so it needs screen-absolute coordinates
  // instead of the table-relative ones the settings button itself still uses.
  const settingsPanelRightPx =
    winWidth - (insets.left + (availableWidth - boxWidth) / 2 + boxWidth) + 12;
  const settingsPanelTopPx = tableTopPx + 54;

  return (
    <View
      onLayout={(event) => setMeasuredViewport(event.nativeEvent.layout)}
      style={styles.viewport}
    >
      {/* Hidden only while this screen is mounted — both restore automatically on unmount,
          same declarative lifecycle as the orientation lock above. This also shrinks the
          safe-area insets used for the table's own sizing below, since there's no longer a
          status/nav bar reserving that space to avoid. */}
      <StatusBar hidden />
      <NavigationBar hidden />
      <Modal animationType="fade" transparent visible={showPostGameChoice}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.eyebrow}>YOU FINISHED!</Text>
            <Text style={styles.title}>You&apos;re a winner</Text>
            {walletBalance !== null && (
              <Text style={styles.muted}>Your balance: {walletBalance} coins</Text>
            )}
            <View style={styles.actions}>
              <PrimaryButton
                label={isLeaving ? 'Leaving...' : 'Leave game'}
                onPress={() => {
                  setIsLeaving(true);
                  void leaveGame().then((left) => {
                    setIsLeaving(false);
                    if (left) {
                      router.replace('/');
                    }
                  });
                }}
              />
              <PrimaryButton
                label="Stay and watch"
                onPress={() => void spectateGame()}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={incomingTransferRequest !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.eyebrow}>CARD REQUEST</Text>
            <Text style={styles.title}>
              {incomingTransferRequest?.requesterName ?? 'A player'} wants to take all your cards
            </Text>
            <Text style={styles.muted}>Do you want to give all your cards?</Text>
            <View style={styles.actions}>
              <PrimaryButton label="Confirm" onPress={() => void respondCardTransfer(true)} />
              <PrimaryButton
                label="Cancel"
                onPress={() => void respondCardTransfer(false)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <ProfileModal
        canRequestCards={canRequestFromProfileModalPlayer}
        isRequestingCards={
          profileModalPlayer !== null && pendingTransferTargetId === profileModalPlayer.id
        }
        onClose={() => setReactionTargetId(null)}
        onRequestCards={() => {
          if (profileModalPlayer === null) {
            return;
          }
          const targetId = profileModalPlayer.id;
          setReactionTargetId(null);
          setPendingTransferTargetId(targetId);
          void requestCardTransfer(targetId).then((accepted) => {
            // The server rejected the request outright (e.g. a stale press just after the
            // turn moved on) — nothing was ever sent to the target, so don't leave this
            // player's screen stuck on "Asking…".
            if (!accepted) {
              setPendingTransferTargetId(null);
            }
          });
        }}
        onSelectReaction={(reaction) => {
          if (profileModalPlayer === null) {
            return;
          }
          void reactToPlayer(profileModalPlayer.id, reaction);
          setReactionTargetId(null);
        }}
        player={profileModalPlayer}
        showCardCounts={room?.showCardCounts ?? false}
      />

      {/* A real Modal (its own top-level native window) rather than an absolutely-positioned
          sibling View + dismiss-overlay pair — that ad-hoc pattern rendered fine but its
          ScrollView never actually engaged Android's native scroll gesture, most likely due to
          touch-stacking ambiguity with the overlapping dismiss overlay. A Modal sidesteps that
          entirely, matching every other popup on this screen. */}
      <Modal animationType="fade" onRequestClose={() => setSoundboardOpen(false)} transparent visible={soundboardOpen}>
        <View style={styles.soundboardModalRoot}>
          <Pressable
            accessibilityLabel="Close soundboard"
            accessibilityRole="button"
            onPress={() => setSoundboardOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.soundboardPanel,
              { bottom: soundboardPanelBottomPx, left: soundboardPanelLeftPx },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.soundboardGrid}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.soundboardScroll}
            >
              {FUN_SOUND_OPTIONS.map((soundId) => (
                <Pressable
                  accessibilityLabel={`Play ${soundId.replace(/-/g, ' ')} sound`}
                  disabled={isAnySoundPlaying}
                  key={soundId}
                  onPress={() => {
                    setSoundboardOpen(false);
                    void playFunSound(soundId);
                  }}
                  style={[styles.soundboardCell, isAnySoundPlaying && styles.soundboardCellDisabled]}
                >
                  <Text style={styles.soundboardEmoji}>{FUN_SOUND_SYMBOLS[soundId]}</Text>
                  <Text numberOfLines={2} style={styles.soundboardLabel}>
                    {soundId.replace(/-/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <TableWrap
        onLayout={(event) => setTableSize(event.nativeEvent.layout)}
        style={[
          styles.table,
          {
            height: renderedBoxHeight,
            left: insets.left + (availableWidth - boxWidth) / 2,
            top: tableTopPx,
            width: boxWidth,
          },
        ]}
        tableImageStyle={styles.tableImage}
      >
        <View style={styles.settingsAnchor}>
          <Pressable
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={() => setSettingsOpen((current) => !current)}
            style={styles.settingsButton}
          >
            <Ionicons color={palette.ink} name="settings-sharp" size={18} />
          </Pressable>
        </View>

        {/* A real Modal (its own top-level native window) rather than an absolutely-positioned
            sibling view — guarantees the panel always draws above every other on-screen
            element (table, cards, seats), which plain zIndex/elevation on a sibling view
            couldn't reliably promise on Android. */}
        <Modal
          animationType="fade"
          onRequestClose={() => setSettingsOpen(false)}
          transparent
          visible={settingsOpen}
        >
          <Pressable
            accessibilityLabel="Close settings"
            accessibilityRole="button"
            onPress={() => setSettingsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.settingsPanel,
              { position: 'absolute', right: settingsPanelRightPx, top: settingsPanelTopPx },
            ]}
          >
            {unavailable ? (
              <Text style={styles.settingsLabel}>Voice chat is unavailable.</Text>
            ) : (
              <>
                <Pressable
                  accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  accessibilityRole="button"
                  onPress={toggleMuted}
                  style={styles.settingsRow}
                >
                  <Ionicons
                    color={isMuted ? palette.muted : palette.red}
                    name={isMuted ? 'mic-off' : 'mic'}
                    size={18}
                  />
                  <Text style={styles.settingsLabel}>{isMuted ? 'Mic off' : 'Mic on'}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={isSpeakerEnabled ? 'Turn speaker off' : 'Turn speaker on'}
                  accessibilityRole="button"
                  onPress={toggleSpeaker}
                  style={styles.settingsRow}
                >
                  <Ionicons
                    color={isSpeakerEnabled ? palette.red : palette.muted}
                    name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'}
                    size={18}
                  />
                  <Text style={styles.settingsLabel}>
                    {isSpeakerEnabled ? 'Sound on' : 'Sound off'}
                  </Text>
                </Pressable>
              </>
            )}
            <View style={styles.settingsDivider} />
            <Pressable
              accessibilityLabel="Leave the table"
              accessibilityRole="button"
              onPress={() => {
                setSettingsOpen(false);
                handleExitTable();
              }}
              style={styles.settingsRow}
            >
              <Ionicons color={palette.red} name="exit-outline" size={18} />
              <Text style={[styles.settingsLabel, styles.settingsLeaveLabel]}>Leave</Text>
            </Pressable>
          </View>
        </Modal>

        {latestReaction !== null && (
          <View style={styles.reactionToast}>
            <Text style={styles.reactionToastText}>
              {gameState.players.find((player) => player.id === latestReaction.fromPlayerId)
                ?.name ?? 'Player'}
              {' sent '}
              {REACTION_SYMBOLS[latestReaction.reaction]}
              {' to '}
              {gameState.players.find((player) => player.id === latestReaction.targetPlayerId)
                ?.name ?? 'Player'}
            </Text>
          </View>
        )}

        {(gameState.requiredSuit !== undefined || error !== null) && (
          <View style={styles.topBanner} pointerEvents="none">
            {gameState.requiredSuit !== undefined && (
              <Text style={styles.required}>
                Required suit: {SUIT_SYMBOLS[gameState.requiredSuit]}
              </Text>
            )}
            {error !== null && <Text style={styles.error}>{error}</Text>}
          </View>
        )}

        {opponents.map((player) => {
          const seat = seatFor(player);
          const isTurn = player.id === gameState.currentPlayerId;
          const isOut = player.status === 'SPECTATING' || player.status === 'LEFT';
          return (
            <Pressable
              accessibilityLabel={`${player.name}'s profile`}
              key={player.id}
              onPress={() => setReactionTargetId((current) => (current === player.id ? null : player.id))}
              style={[styles.seat, seatSizeStyle, { left: `${seat.x}%`, top: `${seat.y}%` }]}
            >
              <View style={styles.avatarWrap}>
                <View
                  style={[
                    styles.playerAvatar,
                    avatarSizeStyle,
                    isTurn && styles.activeAvatar,
                    isOut && styles.outAvatar,
                  ]}
                >
                  <Image
                    resizeMode="cover"
                    source={AVATAR_IMAGES[player.avatar]}
                    // Also sized/rounded directly on the Image itself, not just the clipping
                    // View around it — on Android, an Image whose only sizing comes from a
                    // parent View's dynamically-computed style (avatarSizeStyle is a fresh
                    // object every render, and the array it's composed into also changes
                    // whenever isTurn/isOut flip) can fail to paint until something forces a
                    // fresh layout pass, which made avatars appear to only show up on a
                    // player's own turn. Giving the Image explicit numeric dimensions makes it
                    // paint reliably regardless of what else in the style array changes.
                    style={[styles.playerAvatarImage, avatarSizeStyle]}
                  />
                </View>
                {funSoundFlashPlayerIds.has(player.id) && <AvatarFlash sizePx={avatarSizePx} />}
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                numberOfLines={1}
                style={[styles.playerName, playerNameSizeStyle]}
              >
                {player.name}
              </Text>
              {isTurn && <Text style={styles.turnText}>TURN</Text>}
              {pendingTransferTargetId === player.id && (
                <Text style={styles.askingText}>ASKING…</Text>
              )}
              {player.status === 'FINISHED' && <Text style={styles.wonText}>WON</Text>}
              {isOut && (
                <Text style={styles.outText}>
                  {statusBadgeLabels[player.status as 'SPECTATING' | 'LEFT']}
                </Text>
              )}
            </Pressable>
          );
        })}

        {reactionFlights.map((flight) => {
          const fromPlayer = gameState.players.find((player) => player.id === flight.fromPlayerId);
          const targetPlayer = gameState.players.find(
            (player) => player.id === flight.targetPlayerId,
          );
          const fromSeat = fromPlayer !== undefined ? seatFor(fromPlayer) : ME_SEAT;
          const toSeat = targetPlayer !== undefined ? seatFor(targetPlayer) : ME_SEAT;
          return (
            <ReactionFlyer
              fromXPercent={fromSeat.x}
              fromYPercent={fromSeat.y}
              key={flight.id}
              onComplete={() => removeReactionFlight(flight.id)}
              reactionId={flight.reaction}
              scale={responsiveScale}
              tableHeightPx={tableSize.height}
              tableWidthPx={tableSize.width}
              toXPercent={toSeat.x}
              toYPercent={toSeat.y}
            />
          );
        })}

        {funSoundFlashes.map((flash) => (
          <FunSoundPlayback
            key={flash.id}
            onComplete={() => removeFunSoundFlash(flash.id)}
            soundId={flash.soundId}
          />
        ))}

        <View pointerEvents="none" style={styles.centerPlayArea}>
          {frozenTrick === null &&
            finishingTrick === null &&
            inaamAnimation === null &&
            gameState.currentChaal.length === 0 && (
              <Text style={styles.tableMessage}>The next leader chooses a card.</Text>
            )}

          {(() => {
            const inaamRestCards =
              inaamAnimation === null
                ? undefined
                : inaamAnimation.phase === 'finishing'
                  ? inaamAnimation.cards.slice(0, -1)
                  : inaamAnimation.cards;
            const displayedCards =
              frozenTrick?.cards ?? finishingTrick?.restCards ?? inaamRestCards ?? gameState.currentChaal;
            const rowTotal =
              frozenTrick?.cards.length ??
              finishingTrick?.total ??
              inaamAnimation?.cards.length ??
              gameState.currentChaal.length;
            const isSweepingToDiscard = frozenTrick !== null;
            const isSweepingToReceiver = inaamAnimation?.phase === 'sweeping';
            const receiverPlayer =
              inaamAnimation !== null
                ? gameState.players.find((candidate) => candidate.id === inaamAnimation.receiverId)
                : undefined;
            const receiverSeat = receiverPlayer !== undefined ? seatFor(receiverPlayer) : ME_SEAT;
            const receiverTargetX = (receiverSeat.x / 100) * tableSize.width;
            const receiverTargetY = (receiverSeat.y / 100) * tableSize.height;

            return displayedCards.map((playedCard, index) => {
              // Skip cards still mid-throw — ThrownCard below renders those until they
              // finish landing, at which point this static version takes over seamlessly
              // (same final position and rotation, so there's no visible handoff).
              const throwId = `${playedCard.playerId}-${index}`;
              if (
                frozenTrick === null &&
                inaamAnimation === null &&
                throwingCards.some((entry) => entry.throwId === throwId)
              ) {
                return null;
              }
              const rest = rowPosition(index, rowTotal, tableSize.width, tableCardRowGapPx);
              const isWinner = frozenTrick?.winnerId === playedCard.playerId;
              const cardX = (rest.x / 100) * tableSize.width;
              const cardY = (rest.y / 100) * tableSize.height;

              // A single shared driver (inaamSweepAnim) staggers every card's start so they
              // read as collected one after another, while all still finish together.
              const cardProgress = isSweepingToReceiver
                ? inaamSweepAnim.interpolate({
                    inputRange: [
                      0,
                      rowTotal > 1 ? (index / (rowTotal - 1)) * INAAM_STAGGER_FRACTION : 0,
                      1,
                    ],
                    outputRange: [0, 0, 1],
                    extrapolate: 'clamp',
                  })
                : null;

              const translateX = isSweepingToDiscard
                ? collectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (DISCARD_PILE_X_PERCENT / 100) * tableSize.width - cardX],
                  })
                : (cardProgress?.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, receiverTargetX - cardX],
                  }) ?? 0);
              const translateY = isSweepingToDiscard
                ? collectAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (DISCARD_PILE_Y_PERCENT / 100) * tableSize.height - cardY],
                  })
                : (cardProgress?.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, receiverTargetY - cardY],
                  }) ?? 0);
              // A slight alternating twist and shrink as each card is "pulled" toward the
              // receiver — the depth/scale cue that sells it as being physically collected.
              const inaamRotate =
                cardProgress?.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${(index % 2 === 0 ? 1 : -1) * 16}deg`],
                }) ?? '0deg';
              const inaamScale =
                cardProgress?.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) ?? 1;

              return (
                <Animated.View
                  key={`${playedCard.playerId}-${playedCard.card.id}`}
                  style={[
                    styles.playedCard,
                    {
                      left: `${rest.x}%`,
                      top: `${rest.y}%`,
                      marginLeft: -33,
                      marginTop: -46,
                      transform: [
                        { translateX },
                        { translateY },
                        { rotate: inaamRotate },
                        { scale: inaamScale },
                      ],
                    },
                  ]}
                >
                  <PlayingCard
                    card={playedCard.card}
                    faceDown={(isCollecting && frozenTrick !== null) || isSweepingToReceiver}
                    size="played"
                    style={[
                      tableCardTransformStyle,
                      isWinner && !isCollecting && styles.tableCardHighlight,
                    ]}
                  />
                </Animated.View>
              );
            });
          })()}

          {throwingCards.map((entry) => (
            <ThrownCard
              card={entry.card}
              cardScale={responsiveScale}
              deltaX={entry.deltaX}
              deltaY={entry.deltaY}
              key={entry.throwId}
              onComplete={() => removeThrowingCard(entry.throwId)}
              restRotateDeg={entry.restRotateDeg}
              toXPercent={entry.toXPercent}
              toYPercent={entry.toYPercent}
            />
          ))}

          {discardPile.length > 0 &&
            (() => {
              // Every card in the pile shares this same center anchor (each is centered via
              // its own -33/-46 half-width/half-height margin, nudged +-2px per depth for the
              // stacked look) — the topmost, most-recent card is the last one rendered below.
              // The count badge is pinned to that card's own visual (post-scale) top-right
              // corner, rather than a fixed pixel offset, so it stays right next to the pile
              // regardless of table size or how many cards are in it.
              const topIndex = Math.min(discardPile.length, DISCARD_PILE_VISIBLE_DEPTH) - 1;
              const topOffsetPx = topIndex * 2;
              const scaledHalfWidthPx = (66 * TABLE_CARD_SCALE * responsiveScale) / 2;
              const scaledHalfHeightPx = (92 * TABLE_CARD_SCALE * responsiveScale) / 2;
              return (
                <View
                  style={[
                    styles.discardPile,
                    { left: `${DISCARD_PILE_X_PERCENT}%`, top: `${DISCARD_PILE_Y_PERCENT}%` },
                  ]}
                >
                  {discardPile.slice(-DISCARD_PILE_VISIBLE_DEPTH).map((card, index) => (
                    <PlayingCard
                      faceDown
                      key={card.id}
                      size="played"
                      style={[
                        styles.discardPileCard,
                        tableCardTransformStyle,
                        { marginLeft: -33 + index * 2, marginTop: -46 - index * 2 },
                      ]}
                    />
                  ))}
                  {room?.showCardCounts === true && (
                    <Text
                      style={[
                        styles.discardPileCount,
                        {
                          left: topOffsetPx + scaledHalfWidthPx - (55),
                          top: -topOffsetPx - scaledHalfHeightPx - (-30),
                        },
                      ]}
                    >
                      {discardPile.length}
                    </Text>
                  )}
                </View>
              );
            })()}

          {transferAnimation !== null &&
            (() => {
              const originPlayer = gameState.players.find(
                (candidate) => candidate.id === transferAnimation.targetId,
              );
              const destPlayer = gameState.players.find(
                (candidate) => candidate.id === transferAnimation.requesterId,
              );
              const originSeat = originPlayer !== undefined ? seatFor(originPlayer) : ME_SEAT;
              const destSeat = destPlayer !== undefined ? seatFor(destPlayer) : ME_SEAT;
              const originX = (originSeat.x / 100) * tableSize.width;
              const originY = (originSeat.y / 100) * tableSize.height;
              const deltaX = (destSeat.x / 100) * tableSize.width - originX;
              const deltaY = (destSeat.y / 100) * tableSize.height - originY;
              const visibleCount = Math.min(transferAnimation.cardCount, TRANSFER_VISIBLE_CARD_CAP);

              return Array.from({ length: visibleCount }).map((_, index) => {
                // Same shared-driver stagger technique as the Inaam sweep: every card's own
                // progress is derived from one Animated.Value so later cards start later but
                // all land together, reading as "taken one after another".
                const staggerOffset =
                  visibleCount > 1 ? (index / (visibleCount - 1)) * TRANSFER_STAGGER_FRACTION : 0;
                const progress = transferSweepAnim.interpolate({
                  inputRange: [0, staggerOffset, 1],
                  outputRange: [0, 0, 1],
                  extrapolate: 'clamp',
                });
                const translateX = progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, deltaX],
                });
                const translateY = progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, deltaY],
                });
                const rotate = progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${(index % 2 === 0 ? 1 : -1) * 14}deg`],
                });
                const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

                return (
                  <Animated.View
                    key={`transfer-${index}`}
                    style={[
                      styles.playedCard,
                      {
                        left: `${originSeat.x}%`,
                        top: `${originSeat.y}%`,
                        marginLeft: -33 + index * 2,
                        marginTop: -46 - index * 2,
                        transform: [{ translateX }, { translateY }, { rotate }, { scale }],
                      },
                    ]}
                  >
                    <PlayingCard faceDown size="played" style={tableCardTransformStyle} />
                  </Animated.View>
                );
              });
            })()}
        </View>

        <View style={styles.soundboardAnchor}>
          <Pressable
            accessibilityLabel="Open the soundboard"
            accessibilityRole="button"
            onPress={() => setSoundboardOpen((current) => !current)}
            style={styles.soundboardButton}
          >
            <Ionicons color={palette.ink} name="musical-notes" size={18} />
          </Pressable>
          <Pressable
            accessibilityLabel="Sort cards by suit, highest to lowest"
            accessibilityRole="button"
            onPress={() => setSuitSortSignal((current) => current + 1)}
            style={styles.sortButton}
          >
            <Text style={styles.sortButtonText}>Sort</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.handWrap,
            // `top: 'auto'` (not `undefined`) is what actually cancels handWrap's base
            // `top: '80%'` here — react-native-web doesn't reliably drop a style property
            // set to `undefined` later in the same array, so `top: '80%'` was silently
            // staying active alongside `bottom` on web, and a position with both top and
            // bottom set stretches to fill that span instead of respecting bottom alone —
            // which is why changing handBottomGapPx had no visible effect on web even
            // though the exact same code worked fine on native.
            { bottom: handBottomGapPx, marginTop: 0, top: 'auto' },
          ]}
        >
          <DraggableHand
            availableWidthPx={handAvailableWidthPx}
            canPlay={isMyTurn}
            cardScale={responsiveScale}
            cards={visibleOwnCards}
            onPlay={(cardId) => void playCard(cardId)}
            overlapMultiplier={HAND_OVERLAP_MULTIPLIER_NATIVE}
            suitSortSignal={suitSortSignal}
          />
        </View>
      </TableWrap>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 24,
  },
  activeAvatar: {
    borderColor: palette.red,
  },
  cryingDonkeyImage: {
    height: 110,
    marginTop: 14,
    width: 110,
  },
  gameOverBackdrop: {
    backgroundColor: 'rgba(23, 33, 43, 0.92)',
    flex: 1,
  },
  gameOverCard: {
    alignSelf: 'center',
    backgroundColor: palette.paper,
    borderRadius: 24,
    maxWidth: 520,
    padding: 24,
    width: '100%',
  },
  gameOverCloseButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: palette.ink,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  gameOverScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loserAvatar: {
    borderColor: palette.red,
    borderWidth: 3,
  },
  loserColumn: {
    alignItems: 'center',
    backgroundColor: '#F4E1DD',
  },
  resultAvatar: {
    borderRadius: 28,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  resultAvatarImage: {
    height: '100%',
    width: '100%',
  },
  resultColumn: {
    backgroundColor: palette.white,
    borderRadius: 16,
    flex: 1,
    gap: 10,
    padding: 14,
  },
  resultColumnHeading: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resultColumns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  resultPlayerName: {
    color: palette.ink,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  resultPlayerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  centerPlayArea: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  discardPile: {
    alignItems: 'center',
    position: 'absolute',
  },
  discardPileCard: {
    position: 'absolute',
  },
  discardPileCount: {
    backgroundColor: palette.ink,
    borderRadius: 9,
    color: palette.white,
    fontSize: 10,
    fontWeight: '800',
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    textAlign: 'center',
    top: 56,
  },
  error: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  handWrap: {
    left: 0,
    marginTop: -84,
    position: 'absolute',
    right: 0,
    top: '80%',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 33, 43, 0.6)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: palette.paper,
    borderRadius: 22,
    padding: 24,
    width: '100%',
  },
  muted: {
    color: palette.muted,
    fontSize: 16,
    marginTop: 10,
  },
  outAvatar: {
    opacity: 0.5,
  },
  outText: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
  },
  playedCard: {
    position: 'absolute',
  },
  playerAvatar: {
    alignItems: 'center',
    backgroundColor: '#D9E4D5',
    // A constant, always-present border (not just when it's this player's turn) — Android has
    // a longstanding bug where a View with overflow:'hidden' + borderRadius but NO border can
    // fail to clip/paint its child content at all until a border is present. Previously only
    // activeAvatar added a border, so the avatar image only ever rendered during that
    // player's own turn (when the border briefly appeared), then went blank again once the
    // border was removed. Keeping the border width constant and only swapping its color for
    // the active turn keeps the exact same visual highlight while fixing this permanently.
    borderColor: 'transparent',
    borderRadius: 32,
    borderWidth: 3,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  playerAvatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarWrap: {
    position: 'relative',
  },
  playerName: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    maxWidth: 132,
    textAlign: 'center',
    // Keeps the name legible whether it's sitting over the dark wood, the blue felt, or —
    // in a tight fit on a narrow table — a light card face it happens to overlap.
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
  },
  reactionToast: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '50%',
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    right: 60,
    shadowColor: '#17212B',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    top: 12,
    zIndex: 20,
  },
  reactionToastText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  required: {
    color: palette.saffron,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  seat: {
    alignItems: 'center',
    marginLeft: -66,
    marginTop: -32,
    position: 'absolute',
    width: 132,
    zIndex: 3,
  },
  settingsAnchor: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  settingsButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    zIndex: 1000,
  },
  settingsDivider: {
    backgroundColor: '#EEE9DF',
    height: 1,
    marginVertical: 2,
  },
  settingsLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  settingsLeaveLabel: {
    color: palette.red,
  },
  settingsPanel: {
    backgroundColor: palette.white,
    borderRadius: 12,
    gap: 8,
    padding: 10,
    position: 'absolute',
    width: 150,
  },
  settingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  sortButton: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortButtonText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  soundboardAnchor: {
    alignItems: 'center',
    bottom: 14,
    flexDirection: 'row',
    gap: 8,
    left: 18,
    position: 'absolute',
    zIndex: 500,
  },
  soundboardButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  soundboardCell: {
    alignItems: 'center',
    backgroundColor: '#F3F0E8',
    borderRadius: 10,
    justifyContent: 'center',
    paddingVertical: 6,
    width: 64,
  },
  soundboardCellDisabled: {
    opacity: 0.35,
  },
  soundboardEmoji: {
    fontSize: 20,
  },
  soundboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8,
  },
  soundboardLabel: {
    color: palette.muted,
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  // The ScrollView needs its OWN bounded height to know when to start scrolling — setting
  // maxHeight only on the panel around it just clips the overflow instead of scrolling it.
  // A fixed (not max-) height/width, deliberately: an absolutely-positioned parent whose own
  // size is itself only bounded by maxHeight left the ScrollView's real scrollable viewport
  // ambiguous on Android — it rendered fine but never actually engaged native scrolling.
  // Pinning both to definite numbers removes that ambiguity on every platform.
  soundboardScroll: {
    height: 240,
    width: 224,
  },
  soundboardModalRoot: {
    flex: 1,
  },
  soundboardPanel: {
    backgroundColor: palette.white,
    borderRadius: 12,
    height: 240,
    overflow: 'hidden',
    position: 'absolute',
    width: 224,
  },
  table: {
    alignItems: 'center',
    backgroundColor: '#3B2A1E',
    justifyContent: 'center',
    position: 'absolute',
  },
  tableCardHighlight: {
    borderColor: palette.saffron,
    borderWidth: 3,
    shadowColor: palette.saffron,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  tableImage: {
    borderRadius: 0,
  },
  tableMessage: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  topBanner: {
    alignSelf: 'center',
    gap: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  askingText: {
    color: palette.red,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
  },
  turnText: {
    backgroundColor: palette.saffron,
    borderRadius: 6,
    color: palette.ink,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  viewport: {
    backgroundColor: '#3B2A1E',
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  wonText: {
    color: palette.saffron,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 4,
  },
});
