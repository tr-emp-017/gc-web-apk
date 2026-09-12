import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { PlayingAsCard } from '../../src/components/PlayingAsCard';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { useAccountStore } from '../../src/stores/accountStore';

export default function JoinRoomScreen(): React.JSX.Element {
  const router = useRouter();
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const error = useRoomStore((state) => state.error);
  const account = useAccountStore((state) => state.account);
  const [code, setCode] = useState('GC-');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every room code the server generates is "GC-" followed by 4 digits, so keep that
  // prefix always present — the player only ever needs to type the digits.
  function handleCodeChange(text: string): void {
    const withoutPrefix = text.toUpperCase().replace(/^GC-?/, '');
    const digits = withoutPrefix.replace(/[^0-9]/g, '').slice(0, 4);
    setCode(`GC-${digits}`);
  }

  async function handleJoin(): Promise<void> {
    if (account === null) {
      return;
    }
    setIsSubmitting(true);
    const joined = await joinRoom(code, account.displayName, account.avatar);
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
          keyboardType="number-pad"
          maxLength={7}
          onChangeText={handleCodeChange}
          placeholderTextColor="#9A958B"
          style={styles.input}
          value={code}
        />
        {account !== null && (
          <View style={styles.playingAsWrap}>
            <PlayingAsCard account={account} />
          </View>
        )}
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
  playingAsWrap: {
    marginTop: 18,
  },
  title: {
    color: palette.ink,
    fontSize: 40,
    fontWeight: '900',
    marginTop: 10,
  },
});
