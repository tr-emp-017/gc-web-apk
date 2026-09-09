import { useEffect, useRef, useState } from 'react';
import type { LayoutRectangle } from 'react-native';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import type { VisibleCard as Card } from '@gadha-chor/shared-types';
import { PlayingCard } from './PlayingCard';

const DRAG_THRESHOLD = 4;

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
  readonly sortSignal?: number;
  readonly suitSortSignal?: number;
};

export function DraggableHand({
  cards,
  canPlay,
  onPlay,
  sortSignal,
  suitSortSignal,
}: DraggableHandProps): React.JSX.Element {
  const [order, setOrder] = useState<string[]>(() => cards.map((card) => card.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const layoutsRef = useRef<Record<string, LayoutRectangle>>({});
  const orderRef = useRef(order);
  orderRef.current = order;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const isFirstSortSignal = useRef(true);
  const isFirstSuitSortSignal = useRef(true);

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
    if (isFirstSortSignal.current) {
      isFirstSortSignal.current = false;
      return;
    }
    const cardsById = new Map(cardsRef.current.map((card) => [card.id, card]));
    setOrder((previous) =>
      [...previous].sort((a, b) => {
        const rankA = cardsById.get(a)?.rank ?? 0;
        const rankB = cardsById.get(b)?.rank ?? 0;
        return rankB - rankA;
      }),
    );
  }, [sortSignal]);

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

  return (
    <View style={styles.hand}>
      {orderedCards.map((card) => (
        <DraggableCardItem
          canPlay={canPlay}
          card={card}
          dragPosition={dragPosition}
          isDragging={draggingId === card.id}
          key={card.id}
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
        />
      ))}
    </View>
  );
}

type DraggableCardItemProps = {
  readonly card: Card;
  readonly canPlay: boolean;
  readonly isDragging: boolean;
  readonly dragPosition: Animated.ValueXY;
  readonly onLayoutMeasured: (layout: LayoutRectangle) => void;
  readonly onDragStart: () => void;
  readonly onDragEnd: (dx: number, dy: number) => void;
  readonly onTap: () => void;
};

function DraggableCardItem({
  card,
  canPlay,
  isDragging,
  dragPosition,
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
      onLayout={(event) => onLayoutMeasured(event.nativeEvent.layout)}
      style={[
        styles.handCard,
        !canPlay && styles.handCardDisabled,
        isDragging && {
          transform: dragPosition.getTranslateTransform(),
          zIndex: 10,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <PlayingCard card={card} size="hand" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hand: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  handCard: {
    marginBottom: 10,
    marginRight: 8,
  },
  handCardDisabled: {
    opacity: 0.65,
  },
});
