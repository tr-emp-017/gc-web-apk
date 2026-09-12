import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { PlayingAsCard } from '../../src/components/PlayingAsCard';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { useAccountStore } from '../../src/stores/accountStore';
import { BOT_DIFFICULTIES } from '../../src/bots/difficulties';
import { BOT_PLAYER_COUNTS, type BotDifficultyId, type BotPlayerCount } from '../../src/bots/types';
import { goBackOrHome } from '../../src/utils/goBackOrHome';

const DEFAULT_PLAYER_COUNT: BotPlayerCount = 4;
const DEFAULT_DIFFICULTY: BotDifficultyId = 'medium';
// Purely cosmetic "matchmaking" delay before a bot match actually starts — makes the seats
// filling up feel like a real search instead of an instant, obviously-fake bot insertion.
// Random every time so it never reads as a fixed, predictable wait.
const MIN_SEARCH_SECONDS = 3;
const MAX_SEARCH_SECONDS = 10;

function randomSearchSeconds(): number {
  return (
    MIN_SEARCH_SECONDS + Math.floor(Math.random() * (MAX_SEARCH_SECONDS - MIN_SEARCH_SECONDS + 1))
  );
}

type Mode = 'bots' | 'real';

export default function BotSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const startBotMatch = useRoomStore((state) => state.startBotMatch);
  const quickMatch = useRoomStore((state) => state.quickMatch);
  const error = useRoomStore((state) => state.error);
  const account = useAccountStore((state) => state.account);
  const [mode, setMode] = useState<Mode>('real');
  const [playerCount, setPlayerCount] = useState<BotPlayerCount>(DEFAULT_PLAYER_COUNT);
  const [difficulty, setDifficulty] = useState<BotDifficultyId>(DEFAULT_DIFFICULTY);
  const [showCardCounts, setShowCardCounts] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  useEffect(() => {
    if (countdown === null || account === null) {
      return;
    }
    if (countdown <= 0) {
      void startBotMatch(
        account.displayName,
        account.avatar,
        playerCount,
        difficulty,
        showCardCounts,
      ).then(() => router.replace('/game'));
      return;
    }
    const timer = setTimeout(() => setCountdown((current) => (current ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, account, playerCount, difficulty, showCardCounts, startBotMatch, router]);

  async function handleStart(): Promise<void> {
    if (mode === 'bots') {
      setCountdown(randomSearchSeconds());
      return;
    }
    if (account === null) {
      return;
    }
    setIsMatching(true);
    const matched = await quickMatch(
      account.displayName,
      account.avatar,
      playerCount,
      showCardCounts,
    );
    setIsMatching(false);
    if (matched) {
      const room = useRoomStore.getState().room;
      if (room !== null) {
        router.replace(`/room/${room.code}`);
      }
    }
  }

  if (countdown !== null) {
    return (
      <Screen>
        <View style={styles.searchingWrap}>
          <Text style={styles.eyebrow}>QUICK MATCH</Text>
          <Text style={styles.title}>Finding players to play with you…</Text>
          <Text style={styles.searchingCountdown}>{countdown}</Text>
          <Text style={styles.description}>Get ready — the table is filling up.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>QUICK MATCH</Text>
      <Text style={styles.title}>Play a Match</Text>
      <Text style={styles.description}>
        Jump straight into a live-style match and enjoy the game without waiting for other players.
      </Text>

      <View style={styles.form}>
        {account !== null && <PlayingAsCard account={account} />}

        <Text style={styles.label}>Who do you want to play with?</Text>
        <View style={styles.optionsRow}>
          <Pressable
            accessibilityLabel="Play with bots"
            accessibilityRole="button"
            onPress={() => setMode('bots')}
            style={[styles.modeOption, mode === 'bots' && styles.optionSelected]}
          >
            <Text style={[styles.modeOptionText, mode === 'bots' && styles.optionSelectedText]}>
              🤖 Bots
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Play with real players"
            accessibilityRole="button"
            onPress={() => setMode('real')}
            style={[styles.modeOption, mode === 'real' && styles.optionSelected]}
          >
            <Text style={[styles.modeOptionText, mode === 'real' && styles.optionSelectedText]}>
              👥 Real players
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Number of players</Text>
        <View style={styles.optionsRow}>
          {BOT_PLAYER_COUNTS.map((count) => (
            <Pressable
              accessibilityLabel={`${count} players`}
              accessibilityRole="button"
              key={count}
              onPress={() => setPlayerCount(count)}
              style={[styles.countOption, count === playerCount && styles.optionSelected]}
            >
              <Text
                style={[styles.countOptionText, count === playerCount && styles.optionSelectedText]}
              >
                {count}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'bots' && (
          <>
            <Text style={styles.label}>Difficulty</Text>
            <View style={styles.difficultyList}>
              {BOT_DIFFICULTIES.map((option) => (
                <Pressable
                  accessibilityLabel={`${option.label}, ${option.skillPercent}% skill`}
                  accessibilityRole="button"
                  key={option.id}
                  onPress={() => setDifficulty(option.id)}
                  style={[
                    styles.difficultyOption,
                    option.id === difficulty && styles.optionSelected,
                  ]}
                >
                  <Text style={styles.difficultyEmoji}>{option.emoji}</Text>
                  <View style={styles.difficultyTextWrap}>
                    <Text
                      style={[
                        styles.difficultyLabel,
                        option.id === difficulty && styles.optionSelectedText,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.difficultyHint}>{option.skillPercent}% skill</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.label}>Show opponents&apos; card counts</Text>
            <Text style={styles.hint}>See how many cards your opponents are holding.</Text>
          </View>
          <Switch onValueChange={setShowCardCounts} value={showCardCounts} />
        </View>
        {mode === 'real' && error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isMatching ? 'Finding a table...' : 'Start game'}
          onPress={() => void handleStart()}
        />
        <PrimaryButton label="Back" onPress={() => goBackOrHome(router)} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 32,
  },
  countOption: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  countOptionText: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
  },
  error: {
    color: palette.red,
    fontSize: 14,
  },
  modeOption: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  modeOptionText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  difficultyEmoji: {
    fontSize: 26,
    marginRight: 12,
  },
  difficultyHint: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  difficultyLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  difficultyList: {
    gap: 10,
  },
  difficultyOption: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  difficultyTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  form: {
    gap: 20,
    marginTop: 32,
  },
  hint: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  optionSelected: {
    backgroundColor: '#F5D8A4',
    borderColor: palette.red,
    borderWidth: 2,
  },
  optionSelectedText: {
    color: palette.red,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchingCountdown: {
    color: palette.red,
    fontSize: 64,
    fontWeight: '900',
    marginTop: 28,
  },
  searchingWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: palette.ink,
    fontSize: 40,
    fontWeight: '900',
    marginTop: 10,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleTextWrap: {
    flex: 1,
    marginRight: 12,
  },
});
