import { Screen, palette } from '../src/components/Screen';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { PlayingCard, SUIT_SYMBOLS } from '../src/components/PlayingCard';
import {
  CARD_SCALE as HAND_CARD_SCALE,
  CARD_WIDTH as HAND_CARD_WIDTH,
  DraggableHand,
  computeFanOverlapPx,
} from '../src/components/DraggableHand';
import { ThrownCard } from '../src/components/ThrownCard';
import { useSound } from '../src/hooks/useSound';

import {
  AVATAR_SYMBOLS,
  REACTION_OPTIONS,
  REACTION_SYMBOLS,
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
// the dev-table-preview route this layout is ported from.
const TABLE_ASPECT_RATIO = 16 / 9;
// Table/thrown/discard-pile cards are rendered at "played" size and visually scaled up —
// scaling is centered on each card's own box, so none of the position/centering math below
// needs to change to account for it.
const TABLE_CARD_SCALE = 1.4;
// How far the "You" name/avatar label sits to the left of your hand, and how wide that
// label's own box is (matches styles.seat, reused for every seat including this one).
const MY_LABEL_GAP_PX = 24;
const MY_LABEL_WIDTH_PX = 96;
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
const TABLE_CARD_ROW_GAP_PX = 82;
const TABLE_CARD_ROW_Y_PERCENT = 46;
// Where finished tricks collect, face-down, like a real discard pile — always the same
// spot (bottom-right edge of the felt), regardless of who won the trick.
const DISCARD_PILE_X_PERCENT = 82;
const DISCARD_PILE_Y_PERCENT = 64;
const DISCARD_PILE_VISIBLE_DEPTH = 5;
// How long a finished trick sits still (winning card highlighted) before it's swept up,
// and how long that sweep-to-the-discard-pile animation takes.
const TRICK_HOLD_MS = 3000;
const TRICK_COLLECT_MS = 550;
// An Inaam briefly gathers every card from that chaal in the center before sweeping them
// all toward whoever receives them — shorter than the regular trick hold since there's no
// winning card to read, just a quick "here's what's being handed over" beat.
const INAAM_GATHER_HOLD_MS = 650;
const INAAM_SWEEP_DURATION_MS = 900;
// Fraction of the sweep's timeline spent staggering each card's start — later cards begin
// later but all finish together, reading as "collected one after another".
const INAAM_STAGGER_FRACTION = 0.35;

// Where the i-th of `total` played cards sits in the flat horizontal row across the
// middle of the felt, as a percent of the table box — flat and non-rotated, matching the
// reference layout, instead of scattering each card toward its player's seat. `gapPx` is
// TABLE_CARD_ROW_GAP_PX pre-multiplied by the table's responsive scale.
function rowPosition(index: number, total: number, tableWidthPx: number, gapPx: number): SeatPosition {
  const gapPercent = tableWidthPx > 0 ? (gapPx / tableWidthPx) * 100 : 9;
  const offsetPercent = (index - (total - 1) / 2) * gapPercent;
  return { x: 50 + offsetPercent, y: TABLE_CARD_ROW_Y_PERCENT };
}

// The felt poker-table artwork is a web-only visual upgrade — native still uses the
// plain wood-toned View below, unchanged.
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
  if (Platform.OS === 'web') {
    return (
      <ImageBackground
        imageStyle={tableImageStyle}
        onLayout={onLayout}
        resizeMode="cover"
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
        source={require('../assets/poker-table.jpg')}
        style={style}
      >
        {children}
      </ImageBackground>
    );
  }
  return (
    <View onLayout={onLayout} style={style}>
      {children}
    </View>
  );
}

export default function GameTableScreen(): React.JSX.Element {
  const router = useRouter();
  const room = useRoomStore((state) => state.room);
  const gameState = useRoomStore((state) => state.gameState);
  const playerId = useRoomStore((state) => state.playerId);
  const playCard = useRoomStore((state) => state.playCard);
  const reactToPlayer = useRoomStore((state) => state.reactToPlayer);
  const latestReaction = useRoomStore((state) => state.latestReaction);
  const walletBalance = useRoomStore((state) => state.walletBalance);
  const leaveGame = useRoomStore((state) => state.leaveGame);
  const spectateGame = useRoomStore((state) => state.spectateGame);
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
  const { isMuted, isSpeakerEnabled, toggleMuted, toggleSpeaker, unavailable } = useVoice();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [suitSortSignal, setSuitSortSignal] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingTransferTargetId, setPendingTransferTargetId] = useState<string | null>(null);

  // A resolved transfer (accepted or declined) clears whichever local "asking..." indicator
  // is showing — the requester learns the outcome this way, since gameState itself already
  // reflects an accepted transfer (the target's hand/status change) once it arrives.
  useEffect(() => {
    if (transferResolution === null) {
      return;
    }
    if (transferResolution.requesterId === playerId) {
      setPendingTransferTargetId(null);
    }
    clearTransferResolution();
  }, [transferResolution, playerId, clearTransferResolution]);
  const showCardCounts = room?.showCardCounts ?? false;
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
    return layout?.[seatIndex] ?? { x: 50, y: 10 };
  };

  // The whole screen is the table — letterboxed to TABLE_ASPECT_RATIO and centered,
  // exactly like the dev-table-preview route this layout is ported from.
  let boxWidth = winWidth;
  let boxHeight = boxWidth / TABLE_ASPECT_RATIO;
  if (boxHeight > winHeight) {
    boxHeight = winHeight;
    boxWidth = boxHeight * TABLE_ASPECT_RATIO;
  }
  // Card sizing scales down proportionally on a smaller table instead of holding a fixed
  // pixel size that dominates a small screen.
  const responsiveScale = Math.max(
    MIN_RESPONSIVE_SCALE,
    Math.min(1, boxWidth / RESPONSIVE_SCALE_REFERENCE_WIDTH_PX),
  );
  const tableCardRowGapPx = TABLE_CARD_ROW_GAP_PX * responsiveScale;
  const tableCardTransformStyle = { transform: [{ scale: TABLE_CARD_SCALE * responsiveScale }] };

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

  /* eslint-disable @typescript-eslint/no-require-imports -- static asset requires */
  const playTurnSound = useSound(require('../assets/turn-sound.mp3'));
  const playThrowSound = useSound(require('../assets/throw-sound.mp3'));
  const playCollectSound = useSound(require('../assets/collect-sound.mp3'));
  /* eslint-enable @typescript-eslint/no-require-imports */

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
    return (
      <Screen>
        <Text style={styles.eyebrow}>GAME OVER</Text>
        <Text style={styles.title}>
          {gadhaChor?.id === playerId
            ? 'You are the Gadha Chor'
            : `${gadhaChor?.name ?? 'A player'} is the Gadha Chor`}
        </Text>
        {walletBalance !== null && (
          <Text style={styles.muted}>Your balance: {walletBalance} coins</Text>
        )}
        <View style={styles.actions}>
          <PrimaryButton
            label="Back to home"
            onPress={() => {
              returnHome();
              router.replace('/');
            }}
          />
        </View>
      </Screen>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const showPostGameChoice = myPlayer?.status === 'FINISHED';
  const isMyTurn = gameState.currentPlayerId === playerId;
  // Asking for someone's whole hand instead of a reaction only makes sense while leading a
  // fresh chaal on your own turn (matches the server-side rule in RoomManager) — otherwise
  // tapping an opponent's avatar still opens the reaction picker as before.
  const canRequestCardTransfer =
    isMyTurn && gameState.currentChaal.length === 0 && pendingTransferTargetId === null;
  // Cards an Inaam is currently carrying to you must stay out of your hand's display (and
  // its width math) until the sweep animation actually lands them, even though the server
  // state has already added them.
  const visibleOwnCards =
    inaamCardIdsInFlight !== null && inaamAnimation?.receiverId === playerId
      ? gameState.ownCards.filter((card) => !inaamCardIdsInFlight.has(card.id))
      : gameState.ownCards;

  function handleExitTable(): void {
    const action = myPlayer?.status === 'ACTIVE' ? exitGame : leaveGame;
    void action().finally(() => router.replace('/'));
  }

  // Mirrors the hand's own fan math (DraggableHand) so the "You" label sits just to the
  // left of the hand no matter how wide the hand or the table is.
  const handCount = visibleOwnCards.length;
  const handAvailableWidthPx = tableSize.width * HAND_WIDTH_BUDGET_FRACTION;
  const handOverlapPx = computeFanOverlapPx(handCount, handAvailableWidthPx, responsiveScale);
  const handRowWidthPx = handOverlapPx * Math.max(handCount - 1, 0);
  const handVisualHalfWidthPx = (HAND_CARD_WIDTH / 2) * HAND_CARD_SCALE * responsiveScale;
  // On a narrow table a big hand can still push the label past the left edge even with a
  // tightened fan overlap — clamp so it stays on screen (overlapping the hand slightly in
  // that extreme case) rather than disappearing off the side entirely.
  const minLabelOffsetPx =
    tableSize.width > 0 ? -(tableSize.width / 2) + MY_LABEL_WIDTH_PX / 2 + 6 : Number.NEGATIVE_INFINITY;
  const myLabelOffsetPx = Math.max(
    -(handRowWidthPx / 2) - handVisualHalfWidthPx - MY_LABEL_GAP_PX - MY_LABEL_WIDTH_PX,
    minLabelOffsetPx,
  );

  return (
    <View style={[styles.viewport, { height: winHeight, width: winWidth }]}>
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
              {incomingTransferRequest?.requesterName ?? 'A player'} wants your cards
            </Text>
            <Text style={styles.muted}>
              Give them all your cards and you finish the game — you win! Don&apos;t worry, press
              No if you&apos;d rather keep playing.
            </Text>
            <View style={styles.actions}>
              <PrimaryButton
                label="Yes, give my cards"
                onPress={() => void respondCardTransfer(true)}
              />
              <PrimaryButton
                label="No, keep playing"
                onPress={() => void respondCardTransfer(false)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <TableWrap
        onLayout={(event) => setTableSize(event.nativeEvent.layout)}
        style={[
          styles.table,
          {
            height: boxHeight,
            left: (winWidth - boxWidth) / 2,
            top: (winHeight - boxHeight) / 2,
            width: boxWidth,
          },
        ]}
        tableImageStyle={styles.tableImage}
      >
        <Pressable
          accessibilityLabel="Leave the table"
          accessibilityRole="button"
          onPress={handleExitTable}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>

        <View style={styles.settingsAnchor}>
          <Pressable
            accessibilityLabel="Settings"
            accessibilityRole="button"
            onPress={() => setSettingsOpen((current) => !current)}
            style={styles.settingsButton}
          >
            <Ionicons color={palette.ink} name="settings-sharp" size={18} />
          </Pressable>
          {settingsOpen && (
            <>
              <Pressable
                accessibilityLabel="Close settings"
                accessibilityRole="button"
                onPress={() => setSettingsOpen(false)}
                style={styles.settingsOverlay}
              />
              <View style={styles.settingsPanel}>
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
              </View>
            </>
          )}
        </View>

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
          // While an Inaam is sweeping toward this player, hold their displayed count back
          // to what it was before the transfer until the cards actually arrive.
          const displayedCardsRemaining =
            inaamCardIdsInFlight !== null && inaamAnimation?.receiverId === player.id
              ? Math.max(0, player.cardsRemaining - inaamCardIdsInFlight.size)
              : player.cardsRemaining;
          const fanCount = Math.max(1, Math.min(displayedCardsRemaining, 5));
          const canRequestFromThisPlayer =
            canRequestCardTransfer && !isOut && player.status === 'ACTIVE';
          return (
            <Pressable
              accessibilityLabel={
                canRequestFromThisPlayer
                  ? `Ask ${player.name} to give you all their cards`
                  : undefined
              }
              key={player.id}
              onPress={() => {
                if (canRequestFromThisPlayer) {
                  setPendingTransferTargetId(player.id);
                  void requestCardTransfer(player.id);
                  return;
                }
                setReactionTargetId((current) => (current === player.id ? null : player.id));
              }}
              style={[styles.seat, { left: `${seat.x}%`, top: `${seat.y}%` }]}
            >
              <View
                style={[
                  styles.playerAvatar,
                  isTurn && styles.activeAvatar,
                  isOut && styles.outAvatar,
                ]}
              >
                <Text style={styles.playerAvatarText}>{AVATAR_SYMBOLS[player.avatar]}</Text>
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                numberOfLines={1}
                style={styles.playerName}
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
              {!isOut && displayedCardsRemaining > 0 && (
                <View style={styles.seatCardFan}>
                  {Array.from({ length: fanCount }).map((_, fanIndex) => (
                    <PlayingCard
                      faceDown
                      key={fanIndex}
                      rotateDeg={(fanIndex - (fanCount - 1) / 2) * 8}
                      size="mini"
                      style={[styles.fanCard, { marginLeft: fanIndex === 0 ? 0 : -18 }]}
                    />
                  ))}
                  {showCardCounts && (
                    <View style={styles.cardCountBadge}>
                      <Text style={styles.cardCountText}>{displayedCardsRemaining}</Text>
                    </View>
                  )}
                </View>
              )}
              {reactionTargetId === player.id && (
                <View style={styles.reactionOptions}>
                  {REACTION_OPTIONS.map((reaction) => (
                    <Pressable
                      accessibilityLabel={`Send ${reaction} reaction to ${player.name}`}
                      key={reaction}
                      onPress={() => {
                        void reactToPlayer(player.id, reaction as ReactionId);
                        setReactionTargetId(null);
                      }}
                      style={styles.reactionButton}
                    >
                      <Text style={styles.reactionSymbol}>{REACTION_SYMBOLS[reaction]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}

        {myPlayer !== undefined && (
          <View
            style={[styles.seat, { left: '50%', marginLeft: myLabelOffsetPx, top: '80%', zIndex: 999 }]}
          >
            <View style={styles.playerAvatar}>
              <Text style={styles.playerAvatarText}>{AVATAR_SYMBOLS[myPlayer.avatar]}</Text>
            </View>
            <Text numberOfLines={1} style={styles.playerName}>
              You ({myPlayer.name})
            </Text>
          </View>
        )}

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

          {discardPile.length > 0 && (
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
              <Text style={styles.discardPileCount}>{discardPile.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.sortButtonGroup}>
          <Pressable
            accessibilityLabel="Sort cards by suit, highest to lowest"
            accessibilityRole="button"
            onPress={() => setSuitSortSignal((current) => current + 1)}
            style={styles.sortButton}
          >
            <Text style={styles.sortButtonText}>Sort</Text>
          </Pressable>
        </View>

        <View style={styles.handWrap}>
          <DraggableHand
            availableWidthPx={handAvailableWidthPx}
            canPlay={isMyTurn}
            cardScale={responsiveScale}
            cards={visibleOwnCards}
            onPlay={(cardId) => void playCard(cardId)}
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
    backgroundColor: palette.red,
  },
  cardCountBadge: {
    backgroundColor: palette.ink,
    borderRadius: 9,
    marginLeft: 4,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cardCountText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerPlayArea: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.red,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    left: 10,
    position: 'absolute',
    top: 10,
    width: 32,
    zIndex: 1000,
  },
  closeButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
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
    left: 38,
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
  fanCard: {
    borderColor: '#5E1620',
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
    backgroundColor: '#D9D3C6',
  },
  outText: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  playedCard: {
    position: 'absolute',
  },
  playerAvatar: {
    alignItems: 'center',
    backgroundColor: '#D9E4D5',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  playerAvatarText: {
    color: palette.ink,
    fontSize: 20,
  },
  playerName: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    maxWidth: 96,
    textAlign: 'center',
    // Keeps the name legible whether it's sitting over the dark wood, the blue felt, or —
    // in a tight fit on a narrow table — a light card face it happens to overlap.
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
  },
  reactionButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  reactionOptions: {
    backgroundColor: '#F5D8A4',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 3,
    marginTop: 5,
    padding: 3,
    position: 'absolute',
    top: 70,
    zIndex: 5,
  },
  reactionSymbol: {
    fontSize: 16,
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
    marginLeft: -48,
    marginTop: -18,
    position: 'absolute',
    width: 96,
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
  settingsLabel: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  settingsOverlay: {
    bottom: -1000,
    left: -1000,
    position: 'absolute',
    right: -1000,
    top: -1000,
    zIndex: 999,
  },
  settingsPanel: {
    backgroundColor: palette.white,
    borderRadius: 12,
    gap: 8,
    padding: 10,
    position: 'absolute',
    right: 12,
    top: 54,
    width: 150,
    zIndex: 1000,
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
  sortButtonGroup: {
    bottom: 14,
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
    right: 18,
    zIndex: 500,
  },
  sortButtonText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  seatCardFan: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 6,
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
    top: 12,
    zIndex: 40,
  },
  askingText: {
    color: palette.red,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  turnText: {
    color: palette.saffron,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  viewport: {
    backgroundColor: '#3B2A1E',
    overflow: 'hidden',
    position: 'relative',
  },
  wonText: {
    color: palette.saffron,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
});
