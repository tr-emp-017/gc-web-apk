import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, palette } from '../src/components/Screen';

import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useRef } from 'react';
import { useAccountStore } from '../src/stores/accountStore';
import { AVATAR_IMAGES } from '../src/constants/avatarImages';
import { useRoomStore } from '../src/stores/roomStore';
import { useRouter } from 'expo-router';

// Tapping the title this many times within the window below jumps straight into UI Preview
// Mode — the same trick Android uses to unlock developer options. Unlike the __DEV__-gated
// button further down (which only exists in local dev builds), this works in every build
// including production, so it's the only way to reach the preview screen there — but nobody
// stumbles into it by accident, since it's not a visible control.
const PREVIEW_UNLOCK_TAP_COUNT = 7;
const PREVIEW_UNLOCK_WINDOW_MS = 3000;

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const enterPreviewMode = useRoomStore((state) => state.enterPreviewMode);
  const account = useAccountStore((state) => state.account);
  const titleTapCountRef = useRef(0);
  const titleTapWindowStartRef = useRef(0);

  function handleTitleTap(): void {
    const now = Date.now();
    if (now - titleTapWindowStartRef.current > PREVIEW_UNLOCK_WINDOW_MS) {
      titleTapCountRef.current = 0;
      titleTapWindowStartRef.current = now;
    }
    titleTapCountRef.current += 1;
    if (titleTapCountRef.current >= PREVIEW_UNLOCK_TAP_COUNT) {
      titleTapCountRef.current = 0;
      enterPreviewMode();
      router.push('/game');
    }
  }

  return (
    <Screen>
      {account !== null && (
        <Pressable
          accessibilityLabel="Edit your profile"
          accessibilityRole="button"
          onPress={() => router.push('/account/edit')}
          style={styles.profileChip}
        >
          <Image source={AVATAR_IMAGES[account.avatar]} style={styles.profileAvatar} />
          <Text numberOfLines={1} style={styles.profileName}>
            {account.displayName}
          </Text>
          <Ionicons color={palette.muted} name="chevron-forward" size={16} />
        </Pressable>
      )}

      <View style={styles.header}>
        <Text style={styles.kicker}>DELHI • NORTH INDIA</Text>
        <Text onPress={handleTitleTap} style={styles.title}>
          {'GADHA\nCHOR'}
        </Text>
        <Text style={styles.subtitle}>Lose your cards. Keep your dignity.</Text>
      </View>

      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- static image asset
        source={require('../assets/gadha-hero.jpg')}
        resizeMode="cover"
        style={styles.heroImage}
      />

      <View style={styles.actions}>
        <PrimaryButton label="Create a room" onPress={() => router.push('/room/create')} />
        <PrimaryButton
          label="Join with a code"
          onPress={() => router.push('/room/join')}
          variant="secondary"
        />
        <PrimaryButton
          label="Play"
          onPress={() => router.push('/bots/setup')}
          variant="secondary"
        />
      </View>

      {__DEV__ && (
        <PrimaryButton
          label="🛠 UI Preview Mode (dev)"
          onPress={() => {
            enterPreviewMode();
            router.push('/game');
          }}
          variant="secondary"
        />
      )}

      <Text style={styles.footer}>A fast local card game for 3–6 friends.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  footer: {
    color: palette.muted,
    fontSize: 13,
    marginBottom: 18,
    marginTop: 20,
    textAlign: 'center',
  },
  header: {
    marginTop: 12,
  },
  heroImage: {
    alignSelf: 'center',
    borderRadius: 20,
    height: 220,
    marginTop: 32,
    width: 220,
  },
  kicker: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  profileAvatar: {
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  profileChip: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileName: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 120,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    marginTop: 10,
  },
  title: {
    color: palette.ink,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 49,
    marginTop: 10,
  },
});
