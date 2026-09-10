import { useCallback, useEffect, useRef } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// Loads a sound effect once up front and hands back a function that replays it instantly,
// instead of loading fresh from disk every time it's needed.
export function useSound(assetModule: number): () => void {
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
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
      return;
    }
    void player.seekTo(0);
    player.play();
  }, []);
}
