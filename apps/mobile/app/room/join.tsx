import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { AvatarPicker } from '../../src/components/AvatarPicker';
import { generateRandomGamerName } from '../../src/utils/randomName';
import type { AvatarId } from '@gadha-chor/shared-types';

export default function JoinRoomScreen(): React.JSX.Element {
  const router = useRouter();
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const error = useRoomStore((state) => state.error);
  const [name, setName] = useState(() => generateRandomGamerName());
  const [code, setCode] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('sun');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleJoin(): Promise<void> {
    setIsSubmitting(true);
    const joined = await joinRoom(code, name, avatar);
    setIsSubmitting(false);
    if (joined) {
      const room = useRoomStore.getState().room;
      if (room !== null) {
        router.replace(`/room/${room.code}`);
      }
    }
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>JOIN GAME</Text>
      <Text style={styles.title}>Enter the room</Text>
      <Text style={styles.description}>Use the four digits your host shared with you.</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Room code</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          onChangeText={setCode}
          placeholder="GC-4829"
          placeholderTextColor="#9A958B"
          style={styles.input}
          value={code}
        />
        <AvatarPicker onChange={setAvatar} value={avatar} />
        <Text style={[styles.label, styles.nameLabel]}>Your name</Text>
        <View style={styles.nameRow}>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setName}
            placeholder="e.g. Rahul"
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
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isSubmitting ? 'Joining...' : 'Join room'}
          onPress={() => void handleJoin()}
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
  form: {
    marginTop: 40,
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
  },
  nameInput: {
    flex: 1,
  },
  nameLabel: {
    marginTop: 18,
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
});
