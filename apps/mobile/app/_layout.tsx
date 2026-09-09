import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useRoomStore } from '../src/stores/roomStore';

export default function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const room = useRoomStore((state) => state.room);
  const gameState = useRoomStore((state) => state.gameState);
  const restoreSession = useRoomStore((state) => state.restoreSession);

  useEffect(() => {
    // Only ever attempt this once, on app boot.
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (room === null || pathname !== '/') {
      return;
    }
    if (gameState?.status === 'PLAYING' || gameState?.status === 'GAME_OVER') {
      router.replace('/game');
    } else {
      router.replace(`/room/${room.code}`);
    }
  }, [room, gameState, pathname, router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
