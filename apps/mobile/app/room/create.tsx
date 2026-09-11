import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { AvatarPicker } from '../../src/components/AvatarPicker';
import { generateRandomGamerName } from '../../src/utils/randomName';
import { loadPlayerName, savePlayerName } from '../../src/utils/playerNameStorage';
import type { AvatarId } from '@gadha-chor/shared-types';

// The entry-points UI is hidden for now (to come back later) — the server still requires a
// positive value to create a room, so every room is created with this fixed placeholder.
const FIXED_ENTRY_POINTS = 100;

export default function CreateRoomScreen(): React.JSX.Element {
  const router = useRouter();
  const createRoom = useRoomStore((state) => state.createRoom);
  const error = useRoomStore((state) => state.error);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('beard-glasses');
  const [showCardCounts, setShowCardCounts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill with whatever name was remembered from last time on this device; fall back to a
  // random one for a first-time player. There's no account system, so this is purely a local
  // convenience, not tied to who's actually typing.
  useEffect(() => {
    void loadPlayerName().then((stored) => setName(stored ?? generateRandomGamerName()));
  }, []);

  function updateName(nextName: string): void {
    setName(nextName);
    void savePlayerName(nextName);
  }

  async function handleCreate(): Promise<void> {
    setIsSubmitting(true);
    const created = await createRoom(name, avatar, FIXED_ENTRY_POINTS, showCardCounts);
    setIsSubmitting(false);
    if (created) {
      const room = useRoomStore.getState().room;
      if (room !== null) {
        router.replace(`/room/${room.code}`);
      }
    }
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>NEW GAME</Text>
      <Text style={styles.title}>Create a room</Text>
      <Text style={styles.description}>Pick a name your friends will recognize at the table.</Text>

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
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.label}>Show opponents&apos; card counts</Text>
            <Text style={styles.hint}>Reveal how many cards each opponent is holding.</Text>
          </View>
          <Switch onValueChange={setShowCardCounts} value={showCardCounts} />
        </View>
        <AvatarPicker onChange={setAvatar} value={avatar} />
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isSubmitting ? 'Creating...' : 'Create room'}
          onPress={() => void handleCreate()}
        />
        <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 'auto',
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
    marginTop: 10,
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
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
  form: {
    marginTop: 40,
  },
  hint: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 4,
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
    marginBottom: 8,
    marginTop: 20,
  },
  nameInput: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 8,
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
    marginTop: 20,
  },
  toggleTextWrap: {
    flex: 1,
    marginRight: 12,
  },
});
