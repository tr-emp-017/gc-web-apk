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
// Mode — the same trick Android uses to unlock developer options. This is the only way to
// reach the preview screen (there's no visible button for it), so nobody stumbles into it by
// accident.
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
      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <Image
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- static image asset
            source={require('../assets/gadha-hero.jpg')}
            resizeMode="cover"
            style={styles.smallIcon}
          />
          <View style={styles.headerTextWrap}>
            <Text style={styles.kicker}>DELHI • NORTH INDIA</Text>
            <Text onPress={handleTitleTap} style={styles.title}>
              {'GADHA\nCHOR'}
            </Text>
          </View>
        </View>

        {account !== null && (
          <Pressable
            accessibilityLabel="View and edit your profile"
            accessibilityRole="button"
            onPress={() => router.push('/account/edit')}
            style={styles.profileCard}
          >
            <Image source={AVATAR_IMAGES[account.avatar]} style={styles.profileAvatar} />
            <Text numberOfLines={1} style={styles.profileName}>
              {account.displayName}
            </Text>
            <View style={styles.profileStatsRow}>
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{account.gamesPlayed}</Text>
                <Text style={styles.profileStatLabel}>Played</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{account.losses}</Text>
                <Text style={styles.profileStatLabel}>Losses</Text>
              </View>
            </View>
          </Pressable>
        )}
      </View>

      <View style={styles.linksRow}>
        <Pressable
          accessibilityLabel="View the leaderboard"
          accessibilityRole="button"
          onPress={() => router.push('/leaderboard')}
          style={styles.leaderboardLink}
        >
          <Ionicons color={palette.saffron} name="trophy" size={16} />
          <Text style={styles.leaderboardLinkText}>Leaderboard</Text>
          <Ionicons color={palette.muted} name="chevron-forward" size={14} />
        </Pressable>

        <Pressable
          accessibilityLabel="Browse open rooms"
          accessibilityRole="button"
          onPress={() => router.push('/rooms')}
          style={styles.leaderboardLink}
        >
          <Ionicons color={palette.red} name="people" size={16} />
          <Text style={styles.leaderboardLinkText}>Rooms</Text>
          <Ionicons color={palette.muted} name="chevron-forward" size={14} />
        </Pressable>
      </View>

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
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 12,
  },
  headerTextWrap: {
    flexShrink: 1,
  },
  kicker: {
    color: palette.red,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  leaderboardLink: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leaderboardLinkText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  profileAvatar: {
    alignSelf: 'center',
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: 132,
  },
  profileName: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    maxWidth: 110,
    textAlign: 'center',
  },
  profileStat: {
    alignItems: 'center',
  },
  profileStatDivider: {
    backgroundColor: '#DED8CC',
    height: '100%',
    width: 1,
  },
  profileStatLabel: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  profileStatValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  profileStatsRow: {
    alignItems: 'center',
    borderTopColor: '#DED8CC',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 8,
    width: '100%',
  },
  smallIcon: {
    borderRadius: 20,
    height: 96,
    width: 96,
  },
  title: {
    color: palette.ink,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 36,
    marginTop: 6,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
