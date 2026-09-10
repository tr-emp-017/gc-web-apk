import type { AvatarId, VisibleCard } from '@gadha-chor/shared-types';
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AVATAR_SYMBOLS } from '@gadha-chor/shared-types';
import { Ionicons } from '@expo/vector-icons';
import { PlayingCard } from '../src/components/PlayingCard';
import { determineChaalWinner } from '@gadha-chor/game-engine';
import { generateRandomGamerName } from '../src/utils/randomName';
import { palette } from '../src/components/Screen';
import { useSound } from '../src/hooks/useSound';

// Dev-only route: a full-screen look at the table felt + card layout, with random
// bots seeded in so it never needs a real room/game over sockets. Visit
// /dev-table-preview directly — never linked from anywhere in the app UI.
// Tap a card in your hand to play it; opponents then auto-play in turn, then the
// trick clears and it comes back to you. Delete once the visual work it's for is done.

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
const AVATARS: readonly AvatarId[] = ['sun', 'moon', 'star', 'bolt', 'leaf', 'crown'];

type Seat = {
  readonly avatar: AvatarId;
  readonly name: string;
  readonly x: number;
  readonly y: number;
};

type TableCard = {
  readonly seatIndex: number;
  readonly card: VisibleCard;
};

const MY_HAND_SIZE = 16;
const FAN_CARD_OVERLAP_PX = 34;
const SUIT_SORT_ORDER: Record<VisibleCard['suit'], number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
const OPPONENT_TURN_DELAY_MS = 700;
// How long the finished trick sits still (winning card highlighted) before it gets swept
// up, and how long that sweep-to-the-winner animation takes.
const TRICK_HOLD_MS = 3000;
const TRICK_COLLECT_MS = 550;
const HAND_CARD_SCALE = 1.5;
const TABLE_CARD_SCALE = 1.4;
const MY_LABEL_GAP_PX = 24;

// 6 players total: 5 opponents ringed around the top/sides (the real game's actual
// 5-opponent seat layout), plus you at the bottom — testing a genuinely full table.
const SEAT_LAYOUT: readonly Omit<Seat, 'avatar' | 'name'>[] = [
  { x: 3, y: 46 },
  { x: 16, y: 10 },
  { x: 50, y: 7 },
  { x: 84, y: 10 },
  { x: 97, y: 46 },
  { x: 50, y: 92 },
];
const MY_SEAT_INDEX = SEAT_LAYOUT.length - 1;
// Played cards lay out as a flat horizontal row across the middle of the table, in play
// order, instead of a scattered pile — easier to read at a glance, especially on phones.
const TABLE_CARD_ROW_GAP_PX = 82;
const TABLE_CARD_ROW_Y = 46;
// A fixed spot on the table felt where finished tricks collect, face-down, like a real
// discard pile — always the same place (bottom-right edge of the felt), not wherever the
// winner happens to be sitting.
const DISCARD_PILE_X = 82;
const DISCARD_PILE_Y = 64;
const DISCARD_PILE_VISIBLE_DEPTH = 5;
// You lead, then each opponent seat plays in turn (starting from your right and working
// around to your left), then the trick clears and it's your turn again.
const TURN_ORDER: readonly number[] = [MY_SEAT_INDEX, 4, 3, 2, 1, 0];

function randomCard(): VisibleCard {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? 'spades';
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)] ?? 10;
  return { id: `${suit}-${rank}-${Math.random().toString(36).slice(2)}`, rank, suit };
}

function randomAvatar(): AvatarId {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? 'sun';
}

function sortBySuit(cards: readonly VisibleCard[]): readonly VisibleCard[] {
  return [...cards].sort((a, b) => SUIT_SORT_ORDER[a.suit] - SUIT_SORT_ORDER[b.suit] || b.rank - a.rank);
}

export default function DevTablePreviewScreen(): React.JSX.Element {
  // This layout only makes sense wide (the hand fans out left-right, seats ring a wide
  // oval). Rotating the whole box 90° to "force landscape" on a portrait phone was tried
  // and rejected: it also rotates which screen-axis the hand fans along, turning a
  // horizontal fan into a vertical stack. Simpler and actually correct: keep everything
  // genuinely landscape-oriented, and letterbox — shrink the whole table to the largest
  // 16:9 box that fits the screen, centered, instead of stretching or rotating it.
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const TABLE_ASPECT_RATIO = 16 / 9;
  let boxWidth = winWidth;
  let boxHeight = boxWidth / TABLE_ASPECT_RATIO;
  if (boxHeight > winHeight) {
    boxHeight = winHeight;
    boxWidth = boxHeight * TABLE_ASPECT_RATIO;
  }

  const seats = useMemo<readonly Seat[]>(
    () => SEAT_LAYOUT.map((position) => ({ ...position, avatar: randomAvatar(), name: generateRandomGamerName() })),
    [],
  );
  const [hand, setHand] = useState<readonly VisibleCard[]>(() =>
    // Unsorted on purpose, like a real deal — otherwise the Sort button has nothing to do.
    Array.from({ length: MY_HAND_SIZE }, () => randomCard()),
  );
  const [tableCards, setTableCards] = useState<readonly TableCard[]>([]);
  // Every finished trick lands here, face-down, and stays — a real discard pile that
  // keeps growing on the table instead of vanishing after each trick.
  const [discardPile, setDiscardPile] = useState<readonly VisibleCard[]>([]);
  const [turnPointer, setTurnPointer] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  // Drives the "sweep the finished trick into the discard pile" animation — 0 = cards
  // sitting in their row, 1 = fully collected at the pile.
  const collectAnim = useRef(new Animated.Value(0)).current;
  // True only while cards are actively sweeping to the pile — that's when they flip
  // face-down, like a real discard pile. They stay face-up during the highlight hold.
  const [isCollecting, setIsCollecting] = useState(false);

  const currentSeatIndex = TURN_ORDER[turnPointer % TURN_ORDER.length] ?? MY_SEAT_INDEX;
  const isMyTurn = currentSeatIndex === MY_SEAT_INDEX && turnPointer < TURN_ORDER.length;
  const trickComplete = turnPointer >= TURN_ORDER.length;
  // Same rule the real game uses: the winner is the highest card that follows the suit
  // led by the first card of the chaal — never just "whatever the highest rank is".
  const winningSeatIndex =
    tableCards.length === 0
      ? null
      : Number(
          determineChaalWinner(
            tableCards.map(({ card, seatIndex }) => ({ card, isInaam: false, playerId: String(seatIndex) })),
          ),
        );
  // Same pixel-offset-from-center approach the hand cards use below, so the "You" label
  // sits just to the left of the hand no matter how wide the hand or the screen is. The
  // hand cards are visually scaled up (HAND_CARD_SCALE), so the true painted edge of the
  // leftmost card extends further than its unscaled layout box — account for that here too.
  const handRowWidthPx = FAN_CARD_OVERLAP_PX * (hand.length - 1);
  const handVisualHalfWidthPx = 29 * HAND_CARD_SCALE;
  // myLabelOffsetPx is a marginLeft from the 50% anchor, i.e. the label's LEFT edge — so
  // clearing the hand needs the label's full width (120, from styles.seat) subtracted, not
  // just half of it.
  const myLabelOffsetPx = -(handRowWidthPx / 2) - handVisualHalfWidthPx - MY_LABEL_GAP_PX - 120;

  /* eslint-disable @typescript-eslint/no-require-imports -- static asset requires */
  const playTurnSound = useSound(require('../assets/turn-sound.mp3'));
  const playThrowSound = useSound(require('../assets/throw-sound.mp3'));
  const playCollectSound = useSound(require('../assets/collect-sound.mp3'));
  /* eslint-enable @typescript-eslint/no-require-imports */

  // Play the alert sound and vibrate the device the moment it becomes your turn — not on
  // every render while it stays your turn, just the instant it changes.
  useEffect(() => {
    if (!isMyTurn) {
      return;
    }
    playTurnSound();
    if (Platform.OS !== 'web') {
      Vibration.vibrate(200);
    }
  }, [isMyTurn, playTurnSound]);

  // Opponents auto-play a moment after their turn comes up, purely so the "cards land on
  // the table turn by turn" flow is visible without needing to click for every seat.
  useEffect(() => {
    if (trickComplete || currentSeatIndex === MY_SEAT_INDEX) {
      return;
    }
    const timer = setTimeout(() => {
      playThrowSound();
      setTableCards((current) => [...current, { card: randomCard(), seatIndex: currentSeatIndex }]);
      setTurnPointer((current) => current + 1);
    }, OPPONENT_TURN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentSeatIndex, playThrowSound, trickComplete]);

  // Once everyone has played, hold the full trick (winning card highlighted, face-up) for
  // 3s so it's readable, then flip the cards face-down and sweep them into the fixed
  // discard pile spot before clearing the table and handing the lead back to you.
  useEffect(() => {
    if (!trickComplete) {
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
        setDiscardPile((current) => [...current, ...tableCards.map(({ card }) => card)]);
        setTableCards([]);
        setTurnPointer(0);
        setIsCollecting(false);
        collectAnim.setValue(0);
      });
    }, TRICK_HOLD_MS);
    return () => clearTimeout(holdTimer);
  }, [collectAnim, playCollectSound, trickComplete]);

  function playMyCard(card: VisibleCard): void {
    if (!isMyTurn) {
      return;
    }
    playThrowSound();
    setHand((current) => current.filter((handCard) => handCard.id !== card.id));
    setTableCards((current) => {
      const previousTrickFinished = current.length >= TURN_ORDER.length;
      const base = previousTrickFinished ? [] : current;
      return [...base, { card, seatIndex: MY_SEAT_INDEX }];
    });
    setTurnPointer((current) => current + 1);
  }

  function sortHand(): void {
    setHand((current) => sortBySuit(current));
  }

  return (
    <View style={[styles.viewport, { height: winHeight, width: winWidth }]}>
      <ImageBackground
        resizeMode="cover"
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
        source={require('../assets/poker-table.jpg')}
        style={[
          styles.table,
          {
            height: boxHeight,
            left: (winWidth - boxWidth) / 2,
            top: (winHeight - boxHeight) / 2,
            width: boxWidth,
          },
        ]}
      >
      {settingsOpen && (
        <Pressable
          accessibilityLabel="Close settings"
          accessibilityRole="button"
          onPress={() => setSettingsOpen(false)}
          style={styles.settingsOverlay}
        />
      )}

      <Pressable
        accessibilityLabel="Settings"
        accessibilityRole="button"
        onPress={() => setSettingsOpen((current) => !current)}
        style={styles.settingsButton}
      >
        <Ionicons color={palette.ink} name="settings-sharp" size={18} />
      </Pressable>

      {settingsOpen && (
        <View style={styles.settingsPanel}>
          <Pressable
            accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            accessibilityRole="button"
            onPress={() => setIsMuted((current) => !current)}
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
            onPress={() => setIsSpeakerEnabled((current) => !current)}
            style={styles.settingsRow}
          >
            <Ionicons
              color={isSpeakerEnabled ? palette.red : palette.muted}
              name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'}
              size={18}
            />
            <Text style={styles.settingsLabel}>{isSpeakerEnabled ? 'Sound on' : 'Sound off'}</Text>
          </Pressable>
        </View>
      )}

      {seats.map((seat, index) =>
        index === MY_SEAT_INDEX ? null : (
          <View key={seat.name} style={[styles.seat, { left: `${seat.x}%`, top: `${seat.y}%` }]}>
            <View style={[styles.avatar, index === currentSeatIndex && !trickComplete && styles.avatarActive]}>
              <Text style={styles.avatarText}>{AVATAR_SYMBOLS[seat.avatar]}</Text>
            </View>
            <Text style={styles.name}>{seat.name}</Text>
          </View>
        ),
      )}

      {/* "You" sits to the left of your hand rather than centered under it, so the fanned
          cards aren't fighting your own name/avatar for the same space. */}
      <View style={[styles.seat, { left: '50%', marginLeft: myLabelOffsetPx, top: '80%', zIndex: 999 }]}>
        <View style={[styles.avatar, currentSeatIndex === MY_SEAT_INDEX && !trickComplete && styles.avatarActive]}>
          <Text style={styles.avatarText}>{AVATAR_SYMBOLS[seats[MY_SEAT_INDEX]?.avatar ?? 'sun']}</Text>
        </View>
        <Text style={styles.name}>You ({seats[MY_SEAT_INDEX]?.name ?? ''})</Text>
      </View>

      {discardPile.length > 0 && (
        <View
          style={[
            styles.discardPile,
            { left: `${DISCARD_PILE_X}%`, top: `${DISCARD_PILE_Y}%` },
          ]}
        >
          {discardPile.slice(-DISCARD_PILE_VISIBLE_DEPTH).map((card, index) => (
            <PlayingCard
              faceDown
              key={card.id}
              size="played"
              style={[
                styles.discardPileCard,
                {
                  marginLeft: -26 + index * 2,
                  marginTop: -37 - index * 2,
                  transform: [{ scale: TABLE_CARD_SCALE }],
                },
              ]}
            />
          ))}
          <Text style={styles.discardPileCount}>{discardPile.length}</Text>
        </View>
      )}

      {tableCards.map(({ card, seatIndex }, index) => {
        const count = tableCards.length;
        const rowWidthPx = TABLE_CARD_ROW_GAP_PX * (count - 1);
        const offsetPx = -rowWidthPx / 2 + index * TABLE_CARD_ROW_GAP_PX;
        const cardCenterX = boxWidth / 2 + offsetPx;
        const cardCenterY = (TABLE_CARD_ROW_Y / 100) * boxHeight;
        const targetX = (DISCARD_PILE_X / 100) * boxWidth;
        const targetY = (DISCARD_PILE_Y / 100) * boxHeight;
        const translateX = collectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, targetX - cardCenterX] });
        const translateY = collectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, targetY - cardCenterY] });
        return (
          <Animated.View
            key={card.id}
            style={[
              styles.tableCard,
              {
                left: '50%',
                marginLeft: offsetPx - 26,
                top: `${TABLE_CARD_ROW_Y}%`,
                transform: [{ translateX }, { translateY }],
                zIndex: index,
              },
            ]}
          >
            <PlayingCard
              card={card}
              faceDown={isCollecting}
              size="played"
              style={[
                seatIndex === winningSeatIndex && !isCollecting && styles.tableCardHighlight,
                { transform: [{ scale: TABLE_CARD_SCALE }] },
              ]}
            />
          </Animated.View>
        );
      })}

      <View style={styles.sortButtonGroup}>
        <Pressable
          accessibilityLabel="Sort cards by suit, highest to lowest"
          accessibilityRole="button"
          onPress={sortHand}
          style={styles.sortButton}
        >
          <Text style={styles.sortButtonText}>Sort</Text>
        </Pressable>
      </View>

      {hand.map((card, index) => {
        const offsetX = -handRowWidthPx / 2 + index * FAN_CARD_OVERLAP_PX;
        return (
          <Pressable
            accessibilityLabel={`Play ${card.rank} of ${card.suit}`}
            accessibilityRole="button"
            disabled={!isMyTurn}
            key={card.id}
            onPress={() => playMyCard(card)}
            style={[
              styles.myCard,
              {
                left: '50%',
                marginLeft: offsetX - 29,
                top: '80%',
                zIndex: index,
              },
            ]}
          >
            <PlayingCard card={card} size="hand" style={{ transform: [{ scale: HAND_CARD_SCALE }] }} />
          </Pressable>
        );
      })}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#D9E4D5',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarActive: {
    backgroundColor: palette.red,
  },
  avatarText: {
    color: palette.ink,
    fontSize: 22,
  },
  discardPile: {
    alignItems: 'center',
    position: 'absolute',
  },
  discardPileCard: {
    marginLeft: -26,
    marginTop: -37,
    position: 'absolute',
  },
  discardPileCount: {
    backgroundColor: palette.ink,
    borderRadius: 9,
    color: palette.white,
    fontSize: 10,
    fontWeight: '800',
    left: 30,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    position: 'absolute',
    textAlign: 'center',
    top: 44,
  },
  myCard: {
    marginTop: -46,
    position: 'absolute',
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
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 999,
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
  settingsPanel: {
    backgroundColor: palette.white,
    borderRadius: 12,
    gap: 8,
    padding: 10,
    position: 'absolute',
    right: 12,
    top: 54,
    zIndex: 1000,
  },
  settingsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  name: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    maxWidth: 120,
    textAlign: 'center',
  },
  seat: {
    alignItems: 'center',
    marginLeft: -60,
    marginTop: -22,
    position: 'absolute',
    width: 120,
  },
  table: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  tableCard: {
    marginLeft: -26,
    marginTop: -37,
    position: 'absolute',
  },
  // Only the played cards in the middle of the table get this glow — never the hand.
  tableCardHighlight: {
    borderColor: palette.saffron,
    borderWidth: 3,
    shadowColor: palette.saffron,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  viewport: {
    backgroundColor: '#3B2A1E',
    overflow: 'hidden',
    position: 'relative',
  },
});
