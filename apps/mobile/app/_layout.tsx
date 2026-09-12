import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Platform, StyleSheet, View } from 'react-native';
import { useRoomStore } from '../src/stores/roomStore';
import { useAccountStore } from '../src/stores/accountStore';
import { palette } from '../src/components/Screen';

export default function RootLayout(): React.JSX.Element {
  const router = useRouter();
  const restoreSession = useRoomStore((state) => state.restoreSession);
  const [bootDone, setBootDone] = useState(false);

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
    // Sequenced, not parallel: whether a room-session reconnect should even be attempted
    // depends on an account existing at all — running both at once could have the account
    // redirect to /account/setup land after the reconnect redirect (or the reverse), each
    // stomping on the other's router.replace. Only ever runs once, on app boot.
    let cancelled = false;
    async function boot(): Promise<void> {
      const accountStatus = await useAccountStore.getState().bootstrap();
      if (cancelled) {
        return;
      }
      if (accountStatus === 'needsSetup') {
        router.replace('/account/setup');
        setBootDone(true);
        return;
      }
      const restored = await restoreSession();
      if (cancelled) {
        return;
      }
      if (restored) {
        const { room, gameState } = useRoomStore.getState();
        if (room !== null) {
          if (gameState?.status === 'PLAYING' || gameState?.status === 'GAME_OVER') {
            router.replace('/game');
          } else {
            router.replace(`/room/${room.code}`);
          }
        }
      }
      setBootDone(true);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [restoreSession, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {!bootDone && (
        <View style={styles.bootOverlay}>
          <ActivityIndicator color={palette.red} size="large" />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
