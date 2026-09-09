import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { AvatarPicker } from '../../src/components/AvatarPicker';
import { generateRandomGamerName } from '../../src/utils/randomName';
import type { AvatarId } from '@gadha-chor/shared-types';

const FIXED_ENTRY_POINTS = 100;

export default function CreateRoomScreen(): React.JSX.Element {
  const router = useRouter();
  const createRoom = useRoomStore((state) => state.createRoom);
  const error = useRoomStore((state) => state.error);
  const [name, setName] = useState(() => generateRandomGamerName());
  const [avatar, setAvatar] = useState<AvatarId>('sun');
  const [showCardCounts, setShowCardCounts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            onChangeText={setName}
            placeholder="e.g. Aslam"
            placeholderTextColor="#9A958B"
            style={[styles.input, styles.nameInput]}
            value={name}
          />
          <Pressable
            accessibilityLabel="Generate a random gamer name"
            accessibilityRole="button"
            onPress={() => setName(generateRandomGamerName())}
            style={styles.diceButton}
          >
            <Text style={styles.diceButtonText}>🎲</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Entry points</Text>
        <TextInput
          editable={false}
          style={[styles.input, styles.inputDisabled]}
          value={`${FIXED_ENTRY_POINTS}`}
        />
        <Text style={styles.hint}>Entry points are fixed for now.</Text>
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
  inputDisabled: {
    backgroundColor: '#EFEBE2',
    color: palette.muted,
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
