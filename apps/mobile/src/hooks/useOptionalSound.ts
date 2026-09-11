import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// Same idea as useSound, but tolerates not having an asset yet (see
// reactions/reactionEffects.ts's REACTION_SOUND_ASSETS, which starts mostly empty until each
// sound file arrives) — the returned function just does nothing (and reports 0 duration) until
// a real asset is passed.
//
// The returned play function also reports back how long the clip actually runs (in
// milliseconds) — ReactionFlyer uses this to keep its impact effect on screen for at least as
// long as the sound plays, rather than a fixed guessed duration. A bundled local asset like
// these has normally finished loading well before the player is actually used (the travel
// animation runs first), so `player.duration` is already populated by play time; 0 is returned
// only if that isn't the case yet, or there's no asset at all, and the caller falls back to its
// own configured duration.
export function useOptionalSound(assetModule: number | undefined): () => number {
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

  return useCallback(() => {
    const player = playerRef.current;
    if (player === null) {
      return 0;
    }
    void player.seekTo(0);
    player.play();
    return player.isLoaded ? player.duration * 1000 : 0;
  }, []);
}
