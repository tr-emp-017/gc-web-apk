import { useEffect, useRef, useState } from 'react';
import type { LayoutRectangle } from 'react-native';
import { Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { VisibleCard as Card } from '@gadha-chor/shared-types';
import { Ionicons } from '@expo/vector-icons';
import { PlayingCard } from './PlayingCard';
import { palette } from './Screen';

const DRAG_THRESHOLD = 4;

// Cards fan out in a single overlapping row, like a hand of cards actually held in your
// palm, instead of wrapping into a flexbox grid. CARD_WIDTH/CARD_HEIGHT match the "hand"
// PlayingCard size spec — exported so callers (the felt-relative "You" label) can line
// up against the same geometry without duplicating these numbers.
export const MAX_FAN_OVERLAP_PX = 34;
// Never shrink the exposed sliver of a buried card below this — a big hand on a narrow
// phone is allowed to run slightly past the table's edges rather than pack the fan so
// tight that a card becomes too thin a target to tap.
export const MIN_FAN_OVERLAP_PX = 20;
export const CARD_SCALE = 1.5;
export const CARD_WIDTH = 74;
export const CARD_HEIGHT = 112;
// Beyond this many cards, shrinking the overlap to fit stops being usable (cards become
// too thin to tap) — switch to a fixed overlap plus horizontal scrolling instead.
export const HAND_SCROLL_CARD_THRESHOLD = 16;
// How much of the viewport each arrow press reveals — leaves some overlap with the
// previous view so the scroll doesn't feel like a jarring page-flip.
const SCROLL_ARROW_STEP_FRACTION = 0.7;
// Scaled cards visually bleed past their own unscaled layout box — pad the scrollable
// content so that bleed on the first/last card doesn't get clipped at the scroll edges.
const SCROLL_EDGE_PADDING_PX = 24;

// The fan's per-card overlap shrinks (down to MIN_FAN_OVERLAP_PX) as needed to keep a big
// hand from spilling off a narrow table — a fixed overlap looks great with a handful of
// cards but runs a full hand of 18 well past the edges of a phone-width table. Exported so
// the caller (the felt-relative "You" label) can lay out against the exact same row width.
// `cardScale` is the same responsive multiplier passed to DraggableHand's `cardScale` prop
// — the overlap has to shrink alongside the cards themselves, or a smaller card on a small
// screen ends up looking sparsely spaced instead of proportionally fanned.
// Each card is painted at CARD_WIDTH * CARD_SCALE * cardScale via a centered transform:scale,
// so it visually bleeds past its own CARD_WIDTH-wide layout box by half the size increase —
// that bleed eats into whatever sliver of the card underneath was supposed to stay exposed
// (its corner rank/suit index), so any "desired visible width" must add this back in to get
// the actual layout overlap needed.
function overlapPxForVisibleSliver(visibleSliverPx: number, cardScale: number): number {
  const bleedPx = (CARD_WIDTH * (CARD_SCALE * cardScale - 1)) / 2;
  return visibleSliverPx + Math.max(0, bleedPx);
}

export function computeFanOverlapPx(
  cardCount: number,
  availableWidthPx: number,
  cardScale = 1,
): number {
  const minOverlapPx = overlapPxForVisibleSliver(MIN_FAN_OVERLAP_PX * cardScale, cardScale);
  const maxOverlapPx = overlapPxForVisibleSliver(MAX_FAN_OVERLAP_PX * cardScale, cardScale);
  if (cardCount <= 1 || availableWidthPx <= 0) {
    return maxOverlapPx;
  }
  const cardVisualWidth = CARD_WIDTH * CARD_SCALE * cardScale;
  const fitOverlap = (availableWidthPx - cardVisualWidth) / (cardCount - 1);
  return Math.max(minOverlapPx, Math.min(maxOverlapPx, fitOverlap));
}

const SUIT_ORDER: Record<Card['suit'], number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
};

type DraggableHandProps = {
  readonly cards: readonly Card[];
  readonly canPlay: boolean;
  readonly onPlay: (cardId: string) => void;
  readonly suitSortSignal?: number;
  // Pixel width the fan is allowed to span before its overlap starts tightening up. Pass
  // the felt's measured width so a big hand never spills off a narrow table.
  readonly availableWidthPx: number;
  // Multiplies CARD_SCALE — shrinks the whole hand on a smaller table instead of holding a
  // fixed pixel size that dominates a small screen. Defaults to 1 (no change).
  readonly cardScale?: number;
};

export function DraggableHand({
  cards,
  canPlay,
  onPlay,
  suitSortSignal,
  availableWidthPx,
  cardScale = 1,
}: DraggableHandProps): React.JSX.Element {
  const [order, setOrder] = useState<string[]>(() => cards.map((card) => card.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const layoutsRef = useRef<Record<string, LayoutRectangle>>({});
  const orderRef = useRef(order);
  orderRef.current = order;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const isFirstSuitSortSignal = useRef(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollOffsetPx, setScrollOffsetPx] = useState(0);

  useEffect(() => {
    setOrder((previous) => {
      const incomingIds = new Set(cards.map((card) => card.id));
      const kept = previous.filter((id) => incomingIds.has(id));
      const keptIds = new Set(kept);
      const added = cards.filter((card) => !keptIds.has(card.id)).map((card) => card.id);
      return [...kept, ...added];
    });
  }, [cards]);

  useEffect(() => {
    if (isFirstSuitSortSignal.current) {
      isFirstSuitSortSignal.current = false;
      return;
    }
    const cardsById = new Map(cardsRef.current.map((card) => [card.id, card]));
    setOrder((previous) =>
      [...previous].sort((a, b) => {
        const cardA = cardsById.get(a);
        const cardB = cardsById.get(b);
        const suitA = cardA !== undefined ? SUIT_ORDER[cardA.suit] : 0;
        const suitB = cardB !== undefined ? SUIT_ORDER[cardB.suit] : 0;
        if (suitA !== suitB) {
          return suitA - suitB;
        }
        return (cardB?.rank ?? 0) - (cardA?.rank ?? 0);
      }),
    );
  }, [suitSortSignal]);

  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const orderedCards = order
    .map((id) => cardsById.get(id))
    .filter((card): card is Card => card !== undefined);
  const effectiveCardScale = CARD_SCALE * cardScale;

  // A hand this big can't shrink its way to fitting without becoming untappable — switch
  // to a fixed, comfortable overlap plus horizontal scroll navigation instead.
  const isScrollMode = orderedCards.length > HAND_SCROLL_CARD_THRESHOLD;
  const overlapPx = isScrollMode
    ? overlapPxForVisibleSliver(MAX_FAN_OVERLAP_PX * cardScale, cardScale)
    : computeFanOverlapPx(orderedCards.length, availableWidthPx, cardScale);
  const rowWidthPx = overlapPx * Math.max(orderedCards.length - 1, 0);
  const fanContentWidthPx = rowWidthPx + CARD_WIDTH + SCROLL_EDGE_PADDING_PX * 2;
  const maxScrollOffsetPx = Math.max(0, fanContentWidthPx - availableWidthPx);
  // A hand just over the scroll threshold can still fit comfortably at the fixed overlap
  // (e.g. exactly fitting a wide table) — in that case there's nothing to scroll to, so
  // center the fan instead of leaving it jammed against the left edge.
  const scrollContentStartPx =
    maxScrollOffsetPx > 0
      ? SCROLL_EDGE_PADDING_PX
      : Math.max(SCROLL_EDGE_PADDING_PX, (availableWidthPx - rowWidthPx - CARD_WIDTH) / 2);

  // If the hand shrinks (a card gets played) or the table gets narrower, snap the
  // remembered scroll position back into range instead of leaving it stranded past the end.
  useEffect(() => {
    if (!isScrollMode) {
      if (scrollOffsetPx !== 0) {
        setScrollOffsetPx(0);
      }
      return;
    }
    if (scrollOffsetPx > maxScrollOffsetPx) {
      setScrollOffsetPx(maxScrollOffsetPx);
      scrollViewRef.current?.scrollTo({ animated: false, x: maxScrollOffsetPx });
    }
  }, [isScrollMode, maxScrollOffsetPx, scrollOffsetPx]);

  function scrollByDirection(direction: 1 | -1): void {
    const stepPx = availableWidthPx * SCROLL_ARROW_STEP_FRACTION;
    const nextOffset = Math.max(0, Math.min(maxScrollOffsetPx, scrollOffsetPx + direction * stepPx));
    setScrollOffsetPx(nextOffset);
    scrollViewRef.current?.scrollTo({ animated: true, x: nextOffset });
  }

  function handleDrop(cardId: string, finalDx: number, finalDy: number): void {
    const startLayout = layoutsRef.current[cardId];
    if (startLayout === undefined) {
      return;
    }
    const dropCenterX = startLayout.x + startLayout.width / 2 + finalDx;
    const dropCenterY = startLayout.y + startLayout.height / 2 + finalDy;

    let targetIndex = orderRef.current.indexOf(cardId);
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [id, layout] of Object.entries(layoutsRef.current)) {
      if (id === cardId) {
        continue;
      }
      const centerX = layout.x + layout.width / 2;
      const centerY = layout.y + layout.height / 2;
      const distance = Math.hypot(centerX - dropCenterX, centerY - dropCenterY);
      if (distance < bestDistance) {
        bestDistance = distance;
        const otherIndex = orderRef.current.indexOf(id);
        targetIndex = dropCenterX > centerX ? otherIndex + 1 : otherIndex;
      }
    }

    setOrder((previous) => {
      const next = previous.filter((id) => id !== cardId);
      const clampedIndex = Math.max(0, Math.min(targetIndex, next.length));
      next.splice(clampedIndex, 0, cardId);
      return next;
    });
  }

  const cardItems = orderedCards.map((card, index) => (
    <DraggableCardItem
      anchorLeft={isScrollMode ? scrollContentStartPx : '50%'}
      canPlay={canPlay}
      card={card}
      cardScale={effectiveCardScale}
      dragPosition={dragPosition}
      isDragging={draggingId === card.id}
      key={card.id}
      offsetPx={isScrollMode ? index * overlapPx + CARD_WIDTH / 2 : -rowWidthPx / 2 + index * overlapPx}
      onDragEnd={(dx, dy) => {
        handleDrop(card.id, dx, dy);
        setDraggingId(null);
      }}
      onDragStart={() => {
        dragPosition.setValue({ x: 0, y: 0 });
        setDraggingId(card.id);
      }}
      onLayoutMeasured={(layout) => {
        layoutsRef.current[card.id] = layout;
      }}
      onTap={() => onPlay(card.id)}
      zIndex={index}
    />
  ));

  if (!isScrollMode) {
    return (
      <View style={[styles.hand, { height: CARD_HEIGHT * effectiveCardScale }]}>{cardItems}</View>
    );
  }

  return (
    <View style={[styles.hand, { height: CARD_HEIGHT * effectiveCardScale }]}>
      <ScrollView
        contentContainerStyle={{ width: fanContentWidthPx }}
        horizontal
        overScrollMode="never"
        ref={scrollViewRef}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={[styles.scrollHand, { width: availableWidthPx }]}
      >
        {cardItems}
      </ScrollView>
      {scrollOffsetPx > 0 && (
        <Pressable
          accessibilityLabel="Scroll hand left"
          accessibilityRole="button"
          onPress={() => scrollByDirection(-1)}
          style={[styles.scrollArrow, styles.scrollArrowLeft]}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={18} />
        </Pressable>
      )}
      {scrollOffsetPx < maxScrollOffsetPx && (
        <Pressable
          accessibilityLabel="Scroll hand right"
          accessibilityRole="button"
          onPress={() => scrollByDirection(1)}
          style={[styles.scrollArrow, styles.scrollArrowRight]}
        >
          <Ionicons color={palette.ink} name="chevron-forward" size={18} />
        </Pressable>
      )}
    </View>
  );
}

type DraggableCardItemProps = {
  readonly card: Card;
  readonly canPlay: boolean;
  readonly cardScale: number;
  readonly isDragging: boolean;
  readonly dragPosition: Animated.ValueXY;
  readonly anchorLeft: number | `${number}%`;
  readonly offsetPx: number;
  readonly zIndex: number;
  readonly onLayoutMeasured: (layout: LayoutRectangle) => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: (dx: number, dy: number) => void;
  readonly onTap: () => void;
};

function DraggableCardItem({
  card,
  canPlay,
  cardScale,
  isDragging,
  dragPosition,
  anchorLeft,
  offsetPx,
  zIndex,
  onLayoutMeasured,
  onDragStart,
  onDragEnd,
  onTap,
}: DraggableCardItemProps): React.JSX.Element {
  const hasStartedDragRef = useRef(false);
  const canPlayRef = useRef(canPlay);
  canPlayRef.current = canPlay;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        hasStartedDragRef.current = false;
      },
      onPanResponderMove: (event, gestureState) => {
        if (
          !hasStartedDragRef.current &&
          (Math.abs(gestureState.dx) > DRAG_THRESHOLD || Math.abs(gestureState.dy) > DRAG_THRESHOLD)
        ) {
          hasStartedDragRef.current = true;
          onDragStart();
        }
        if (hasStartedDragRef.current) {
          Animated.event([null, { dx: dragPosition.x, dy: dragPosition.y }], {
            useNativeDriver: false,
          })(event, gestureState);
        }
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (hasStartedDragRef.current) {
          onDragEnd(gestureState.dx, gestureState.dy);
        } else if (canPlayRef.current) {
          onTapRef.current();
        }
        hasStartedDragRef.current = false;
      },
      onPanResponderTerminate: (_event, gestureState) => {
        if (hasStartedDragRef.current) {
          onDragEnd(gestureState.dx, gestureState.dy);
        }
        hasStartedDragRef.current = false;
      },
      onStartShouldSetPanResponder: () => true,
    }),
  ).current;

  return (
    <Animated.View
      accessibilityLabel={`Play ${card.rank} of ${card.suit}`}
      accessibilityRole="button"
      onLayout={(event) => onLayoutMeasured(event.nativeEvent.layout)}
      style={[
        styles.handCard,
        {
          left: anchorLeft,
          marginLeft: offsetPx - CARD_WIDTH / 2,
          zIndex: isDragging ? 999 : zIndex,
        },
        !canPlay && styles.handCardDisabled,
        isDragging && { transform: dragPosition.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      <PlayingCard card={card} size="hand" style={{ transform: [{ scale: cardScale }] }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hand: {
    width: '100%',
    overflow: 'visible',
  },
  handCard: {
    position: 'absolute',
    top: 0,
  },
  handCardDisabled: {
    opacity: 0.65,
  },
  scrollArrow: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    zIndex: 1000,
  },
  scrollArrowLeft: {
    left: -4,
  },
  scrollArrowRight: {
    right: -4,
  },
  scrollHand: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
});
