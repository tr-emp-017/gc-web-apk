import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useRoomStore } from '../src/stores/roomStore';

export default function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const restoreSession = useRoomStore((state) => state.restoreSession);

  useEffect(() => {
    // Only ever attempt this once, on app boot — never react to later state changes,
    // otherwise navigating "back home" after a finished game immediately bounces back.
    let cancelled = false;
    void restoreSession().then((restored) => {
      if (cancelled || !restored) {
        return;
      }
      const { room, gameState } = useRoomStore.getState();
      if (room === null) {
        return;
      }
      if (gameState?.status === 'PLAYING' || gameState?.status === 'GAME_OVER') {
        router.replace('/game');
      } else {
        router.replace(`/room/${room.code}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [restoreSession, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
