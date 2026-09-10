import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { useRoomStore } from '../src/stores/roomStore';

export default function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const restoreSession = useRoomStore((state) => state.restoreSession);

  useEffect(() => {
    // Ask for the mic up front, on app open, instead of leaving the first prompt to
    // whenever voice chat happens to spin up mid-game. There's no separate Android
    // permission for audio output/speaker — RECORD_AUDIO is the only one voice chat needs.
    if (Platform.OS === 'android') {
      const recordAudioPermission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
      if (recordAudioPermission !== undefined) {
        void PermissionsAndroid.request(recordAudioPermission);
      }
    }
  }, []);

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
