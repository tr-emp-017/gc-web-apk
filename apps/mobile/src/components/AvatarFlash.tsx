import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { palette } from './Screen';

const PULSE_HALF_CYCLE_MS = 260;

type AvatarFlashProps = {
  // Matches the avatar's own current size (avatarSizeStyle in game.tsx) so the ring sits
  // exactly on top of it regardless of table size / responsive scaling.
  readonly sizePx: number;
};

// A pulsing ring overlaid on a player's avatar while they're playing something from the
// soundboard — purely a presentation effect; game.tsx decides how long to keep it mounted
// (matching how long the sound actually plays, see FunSoundPlayback).
export function AvatarFlash({ sizePx }: AvatarFlashProps): React.JSX.Element {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { duration: PULSE_HALF_CYCLE_MS, toValue: 1, useNativeDriver: true }),
        Animated.timing(pulse, { duration: PULSE_HALF_CYCLE_MS, toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          borderRadius: sizePx / 2,
          height: sizePx,
          left: 0,
          opacity,
          top: 0,
          transform: [{ scale }],
          width: sizePx,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    borderColor: palette.saffron,
    borderWidth: 4,
    position: 'absolute',
  },
});
