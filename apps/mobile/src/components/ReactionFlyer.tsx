import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import type { ReactionId } from '@gadha-chor/shared-types';
import { REACTION_SYMBOLS } from '@gadha-chor/shared-types';
import { REACTION_EFFECTS, REACTION_SOUND_ASSETS } from '../reactions/reactionEffects';
import { useOptionalSound } from '../hooks/useOptionalSound';

// How far above the straight line between sender and target the emoji arcs at the midpoint
// of its travel, as a fraction of the travel distance — capped so a long cross-table throw
// doesn't arc absurdly high.
const ARC_HEIGHT_FRACTION = 0.35;
const ARC_HEIGHT_MAX_PX = 120;
const BASE_EMOJI_FONT_SIZE = 36;
const BASE_IMPACT_FONT_SIZE = 44;
// The anchor box's own size — generous enough to fit the largest impact emoji at scale 1
// without clipping, centered exactly on the target's (left/top: X%/Y%) point via a negative
// margin, the same convention styles.seat uses elsewhere in game.tsx.
const ANCHOR_SIZE_PX = 100;

type ReactionFlyerProps = {
  readonly reactionId: ReactionId;
  // Percent-of-table coordinates, same convention as every seat position in game.tsx.
  readonly fromXPercent: number;
  readonly fromYPercent: number;
  readonly toXPercent: number;
  readonly toYPercent: number;
  readonly tableWidthPx: number;
  readonly tableHeightPx: number;
  // Shrinks the whole effect on a smaller table, same convention as responsiveScale
  // elsewhere in game.tsx. Defaults to 1 (no change).
  readonly scale?: number;
  // Called once both the travel and the impact effect have fully finished — the parent
  // removes this flyer from its list at that point.
  readonly onComplete: () => void;
};

// One reaction sent from a player's profile popup: the chosen emoji flies from the sender's
// seat to the target's, then bursts into a short impact effect at the target. Purely a
// presentation effect — every connected client (sender, target, and bystanders) renders this
// the moment the server broadcasts 'player:reacted', so everyone sees the same throw.
export function ReactionFlyer({
  reactionId,
  fromXPercent,
  fromYPercent,
  toXPercent,
  toYPercent,
  tableWidthPx,
  tableHeightPx,
  scale = 1,
  onComplete,
}: ReactionFlyerProps): React.JSX.Element {
  const effect = REACTION_EFFECTS[reactionId];
  const [phase, setPhase] = useState<'traveling' | 'impact'>('traveling');
  const [impactAnimationDone, setImpactAnimationDone] = useState(false);
  // Only sounds with a real asset need to be waited on — see useOptionalSound for why this
  // is now tracked via the player's actual finish event instead of a guessed duration.
  const [soundFinished, setSoundFinished] = useState(REACTION_SOUND_ASSETS[reactionId] === undefined);
  const hasCompletedRef = useRef(false);
  const travelProgress = useRef(new Animated.Value(0)).current;
  const impactProgress = useRef(new Animated.Value(0)).current;
  const playImpactSound = useOptionalSound(REACTION_SOUND_ASSETS[reactionId]);

  useEffect(() => {
    const animation = Animated.timing(travelProgress, {
      duration: effect.travelDurationMs,
      easing: Easing.out(Easing.quad),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        playImpactSound(() => setSoundFinished(true));
        setPhase('impact');
      }
    });
    return () => animation.stop();
    // Runs once per mount: a flyer exists for exactly one reaction throw, then the parent
    // unmounts it once onComplete fires.
  }, []);

  useEffect(() => {
    if (phase !== 'impact') {
      return;
    }
    const animation = Animated.timing(impactProgress, {
      duration: effect.impactDurationMs,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setImpactAnimationDone(true);
      }
    });
    return () => animation.stop();
  }, [phase]);

  // Only unmounts (and so only releases the sound player) once both the impact animation has
  // played out AND the sound has genuinely finished — never before, so the sound is never cut
  // off early regardless of how long the impact animation itself runs.
  useEffect(() => {
    if (impactAnimationDone && soundFinished && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  }, [impactAnimationDone, soundFinished, onComplete]);

  const deltaX = ((fromXPercent - toXPercent) / 100) * tableWidthPx;
  const deltaY = ((fromYPercent - toYPercent) / 100) * tableHeightPx;
  const travelDistancePx = Math.hypot(deltaX, deltaY);
  const arcHeightPx = Math.min(ARC_HEIGHT_MAX_PX, travelDistancePx * ARC_HEIGHT_FRACTION);

  const linearX = travelProgress.interpolate({ inputRange: [0, 1], outputRange: [deltaX, 0] });
  const linearY = travelProgress.interpolate({ inputRange: [0, 1], outputRange: [deltaY, 0] });
  const arcLift = travelProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -arcHeightPx, 0],
  });
  const travelTranslateY = Animated.add(linearY, arcLift);
  const travelRotate = travelProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${effect.travelSpinDeg}deg`],
  });
  const travelOpacity = travelProgress.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [1, 1, 0],
  });

  const impactScale = impactProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.3, 1.3, 1],
  });
  const impactOpacity = impactProgress.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });

  const anchorSizePx = ANCHOR_SIZE_PX * scale;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.anchor,
        {
          height: anchorSizePx,
          left: `${toXPercent}%`,
          marginLeft: -anchorSizePx / 2,
          marginTop: -anchorSizePx / 2,
          top: `${toYPercent}%`,
          width: anchorSizePx,
        },
      ]}
    >
      {phase === 'traveling' && (
        <Animated.Text
          style={[
            styles.emoji,
            { fontSize: BASE_EMOJI_FONT_SIZE * scale },
            {
              opacity: travelOpacity,
              transform: [
                { translateX: linearX },
                { translateY: travelTranslateY },
                { rotate: travelRotate },
              ],
            },
          ]}
        >
          {REACTION_SYMBOLS[reactionId]}
        </Animated.Text>
      )}
      {phase === 'impact' && (
        <Animated.Text
          style={[
            styles.emoji,
            { fontSize: BASE_IMPACT_FONT_SIZE * scale },
            { opacity: impactOpacity, transform: [{ scale: impactScale }] },
          ]}
        >
          {effect.impactEmoji}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 900,
  },
  emoji: {
    textAlign: 'center',
  },
});
