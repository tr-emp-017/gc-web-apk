import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LeaderboardEntry } from '@gadha-chor/shared-types';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { Screen, palette } from '../src/components/Screen';
import { AVATAR_IMAGES } from '../src/constants/avatarImages';
import { getLeaderboard } from '../src/api/accountApi';
import { useAccountStore } from '../src/stores/accountStore';
import { goBackOrHome } from '../src/utils/goBackOrHome';

type LoadState = 'loading' | 'ready' | 'error';

export default function LeaderboardScreen(): React.JSX.Element {
  const router = useRouter();
  const account = useAccountStore((state) => state.account);
  const [entries, setEntries] = useState<readonly LeaderboardEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    getLeaderboard()
      .then((result) => {
        if (!cancelled) {
          setEntries(result);
          setLoadState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>TOP PLAYERS</Text>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => goBackOrHome(router)}
          style={styles.topBackButton}
        >
          <Ionicons color={palette.ink} name="arrow-back" size={20} />
        </Pressable>
      </View>

      <Text style={styles.title}>Leaderboard</Text>

      {loadState === 'loading' && (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={palette.red} size="large" />
        </View>
      )}

      {loadState === 'error' && (
        <View style={styles.centerWrap}>
          <Text style={styles.error}>Couldn't load the leaderboard. Check your connection.</Text>
        </View>
      )}

      {loadState === 'ready' && (
        <View style={styles.list}>
          {entries.map((entry, index) => (
            <LeaderboardRow
              entry={entry}
              isYou={account !== null && entry.playerId === account.playerId}
              key={`${entry.playerId}-${index}`}
              rank={index + 1}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <PrimaryButton label="Back" onPress={() => goBackOrHome(router)} variant="secondary" />
      </View>
    </Screen>
  );
}

function LeaderboardRow({
  entry,
  rank,
  isYou,
}: {
  readonly entry: LeaderboardEntry;
  readonly rank: number;
  readonly isYou: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.row, isYou && styles.rowYou]}>
      <Text style={styles.rank}>{rank}</Text>
      <Image resizeMode="cover" source={AVATAR_IMAGES[entry.avatar]} style={styles.avatar} />
      <View style={styles.nameWrap}>
        <Text numberOfLines={1} style={styles.name}>
          {entry.displayName}
          {isYou ? ' (You)' : ''}
        </Text>
        <Text style={styles.played}>{entry.gamesPlayed} played</Text>
      </View>
      <View style={styles.statsWrap}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, styles.winValue]}>{entry.wins}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{entry.losses}</Text>
          <Text style={styles.statLabel}>Losses</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  avatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  centerWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  error: {
    color: palette.red,
    fontSize: 14,
    textAlign: 'center',
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  list: {
    gap: 8,
    paddingBottom: 16,
    paddingTop: 20,
  },
  name: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  nameWrap: {
    flex: 1,
  },
  played: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  rank: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: '800',
    width: 24,
  },
  row: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowYou: {
    borderColor: palette.red,
    borderWidth: 2,
  },
  stat: {
    alignItems: 'center',
    minWidth: 40,
  },
  statLabel: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  statValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  statsWrap: {
    flexDirection: 'row',
    gap: 12,
  },
  title: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 10,
  },
  topBackButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  winValue: {
    color: '#2E7D32',
  },
});
