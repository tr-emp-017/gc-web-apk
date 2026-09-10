import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import type { VisibleCard } from '@gadha-chor/shared-types';
import { PlayingCard } from './PlayingCard';

const THROW_DURATION_MS = 380;
// How much the card twists mid-flight relative to where it settles — opposite the
// direction of travel, so it reads as a natural flick of the wrist rather than a slide.
const THROW_TWIST_DEG = 22;
// Matches the table/discard-pile card scale in game.tsx — applied to the inner card so it
// composes with (rather than fights) the outer landing-bounce scale animated below.
const TABLE_CARD_SCALE = 1.4;

type ThrownCardProps = {
  readonly card: VisibleCard;
  // Pixel offset from the card's resting spot back to the seat it was thrown from —
  // the animation runs this delta down to (0, 0) as it lands.
  readonly deltaX: number;
  readonly deltaY: number;
  readonly restRotateDeg: number;
  readonly toXPercent: number;
  readonly toYPercent: number;
  readonly onComplete: () => void;
  // Multiplies TABLE_CARD_SCALE — shrinks the thrown card on a smaller table instead of
  // holding a fixed pixel size that dominates a small screen. Defaults to 1 (no change).
  readonly cardScale?: number;
};

// Renders one card mid-flight from a player's seat to its resting spot in the middle of
// the chaal. Purely a presentation effect: it's triggered by a server-confirmed card
// having appeared in currentChaal (see game.tsx), never by user input directly, and it
// settles at the exact same spot the static, non-animated card would render at — so
// swapping this out for the plain PlayingCard once onComplete fires is seamless.
export function ThrownCard({
  card,
  deltaX,
  deltaY,
  restRotateDeg,
  toXPercent,
  toYPercent,
  onComplete,
  cardScale = 1,
}: ThrownCardProps): React.JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      duration: THROW_DURATION_MS,
      easing: Easing.out(Easing.back(1.3)),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });
    return () => animation.stop();
    // Intentionally runs once on mount only: this component exists for exactly one throw,
    // then the parent unmounts it. Re-running on an unstable onComplete identity would
    // restart the animation mid-flight.
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [deltaX, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [deltaY, 0] });
  const twistDeg = deltaX >= 0 ? -THROW_TWIST_DEG : THROW_TWIST_DEG;
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${restRotateDeg + twistDeg}deg`, `${restRotateDeg}deg`],
  });
  // A quick pop past full size then settling back — the "subtle bounce" landing feel.
  const scale = progress.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.78, 1.1, 1],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <Animated.View
      style={[
        styles.anchor,
        { left: `${toXPercent}%`, top: `${toYPercent}%` },
        { transform: [{ translateX }, { translateY }, { rotate }, { scale }], shadowOpacity },
      ]}
    >
      <PlayingCard
        card={card}
        size="played"
        style={{ transform: [{ scale: TABLE_CARD_SCALE * cardScale }] }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    marginLeft: -33,
    marginTop: -46,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowRadius: 6,
  },
});
