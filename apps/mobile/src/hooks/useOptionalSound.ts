import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// Same idea as useSound, but tolerates not having an asset yet (see
// reactions/reactionEffects.ts's REACTION_SOUND_ASSETS, which starts mostly empty until each
// sound file arrives) — the returned function just calls onFinish immediately until a real
// asset is passed.
//
// The returned play function reports back when the clip has ACTUALLY finished playing, via
// expo-audio's own 'playbackStatusUpdate' (didJustFinish) event, rather than guessing a
// duration from `player.duration` right after calling play(). That guess used to work fine on
// native (a bundled local file's metadata is already available by play time) but was wrong on
// web: the underlying HTML5 <audio> element only knows its real duration once its
// 'loadedmetadata' fires asynchronously, which hadn't happened yet — so `player.duration` read
// 0, callers fell back to their own short configured duration, and unmounted (removing the
// player) long before the clip actually finished, cutting web playback off after a couple of
// seconds while native played the full clip.
export function useOptionalSound(assetModule: number | undefined): (onFinish?: () => void) => void {
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (assetModule === undefined) {
      return;
    }
    const player = createAudioPlayer(assetModule);
    playerRef.current = player;
    return () => {
      playerRef.current = null;
      player.remove();
    };
  }, [assetModule]);

  return useCallback((onFinish) => {
    const player = playerRef.current;
    if (player === null) {
      onFinish?.();
      return;
    }
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        onFinish?.();
      }
    });
    void player.seekTo(0);
    player.play();
  }, []);
}
