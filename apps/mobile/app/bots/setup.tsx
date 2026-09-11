import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { AvatarPicker } from '../../src/components/AvatarPicker';
import { generateRandomGamerName } from '../../src/utils/randomName';
import { loadPlayerName, savePlayerName } from '../../src/utils/playerNameStorage';
import { BOT_DIFFICULTIES } from '../../src/bots/difficulties';
import { BOT_PLAYER_COUNTS, type BotDifficultyId, type BotPlayerCount } from '../../src/bots/types';
import type { AvatarId } from '@gadha-chor/shared-types';

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

export default function BotSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const startBotMatch = useRoomStore((state) => state.startBotMatch);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('beard-glasses');
  const [playerCount, setPlayerCount] = useState<BotPlayerCount>(DEFAULT_PLAYER_COUNT);
  const [difficulty, setDifficulty] = useState<BotDifficultyId>(DEFAULT_DIFFICULTY);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    void loadPlayerName().then((stored) => setName(stored ?? generateRandomGamerName()));
  }, []);

  useEffect(() => {
    if (countdown === null) {
      return;
    }
    if (countdown <= 0) {
      startBotMatch(name, avatar, playerCount, difficulty);
      router.replace('/game');
      return;
    }
    const timer = setTimeout(() => setCountdown((current) => (current ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, name, avatar, playerCount, difficulty, startBotMatch, router]);

  function updateName(nextName: string): void {
    setName(nextName);
    void savePlayerName(nextName);
  }

  function handleStart(): void {
    setCountdown(randomSearchSeconds());
  }

  if (countdown !== null) {
    return (
      <Screen>
        <View style={styles.searchingWrap}>
          <Text style={styles.eyebrow}>PRACTICE MATCH</Text>
          <Text style={styles.title}>Finding players to play with you…</Text>
          <Text style={styles.searchingCountdown}>{countdown}</Text>
          <Text style={styles.description}>Get ready — the table is filling up.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>PRACTICE MATCH</Text>
      <Text style={styles.title}>Play with bots</Text>
      <Text style={styles.description}>
        An instant, free match against computer players — no points at stake.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Your name</Text>
        <View style={styles.nameRow}>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={updateName}
            placeholder="e.g. Aslam"
            placeholderTextColor="#9A958B"
            style={[styles.input, styles.nameInput]}
            value={name}
          />
          <Pressable
            accessibilityLabel="Generate a random gamer name"
            accessibilityRole="button"
            onPress={() => updateName(generateRandomGamerName())}
            style={styles.diceButton}
          >
            <Text style={styles.diceButtonText}>🎲</Text>
          </Pressable>
        </View>

        <AvatarPicker onChange={setAvatar} value={avatar} />

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

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.difficultyList}>
          {BOT_DIFFICULTIES.map((option) => (
            <Pressable
              accessibilityLabel={`${option.label}, ${option.skillPercent}% skill`}
              accessibilityRole="button"
              key={option.id}
              onPress={() => setDifficulty(option.id)}
              style={[styles.difficultyOption, option.id === difficulty && styles.optionSelected]}
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
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Start game" onPress={handleStart} />
        <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
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
  diceButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  diceButtonText: {
    fontSize: 22,
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
    marginTop: 32,
  },
  input: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 17,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 24,
  },
  nameInput: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
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
});
