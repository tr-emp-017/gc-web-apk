import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

// Loads a sound effect once up front and hands back a function that replays it instantly,
// instead of loading fresh from disk every time it's needed.
export function useSound(assetModule: number): () => void {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cancelled = false;
    Audio.Sound.createAsync(assetModule).then(({ sound }) => {
      if (cancelled) {
        void sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
    });
    return () => {
      cancelled = true;
      void soundRef.current?.unloadAsync();
    };
  }, [assetModule]);

  return useCallback(() => {
    void soundRef.current?.replayAsync();
  }, []);
}
