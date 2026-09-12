import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { PlayingAsCard } from '../../src/components/PlayingAsCard';
import { Screen, palette } from '../../src/components/Screen';
import { useRoomStore } from '../../src/stores/roomStore';
import { useAccountStore } from '../../src/stores/accountStore';

// The entry-points UI is hidden for now (to come back later) — the server still requires a
// positive value to create a room, so every room is created with this fixed placeholder.
const FIXED_ENTRY_POINTS = 100;

export default function CreateRoomScreen(): React.JSX.Element {
  const router = useRouter();
  const createRoom = useRoomStore((state) => state.createRoom);
  const error = useRoomStore((state) => state.error);
  const account = useAccountStore((state) => state.account);
  const [showCardCounts, setShowCardCounts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate(): Promise<void> {
    if (account === null) {
      return;
    }
    setIsSubmitting(true);
    const created = await createRoom(
      account.displayName,
      account.avatar,
      FIXED_ENTRY_POINTS,
      showCardCounts,
    );
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
      <Text style={styles.description}>Your friends will see you at the table by this name.</Text>

      <View style={styles.form}>
        {account !== null && <PlayingAsCard account={account} />}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.label}>Show opponents&apos; card counts</Text>
            <Text style={styles.hint}>Reveal how many cards each opponent is holding.</Text>
          </View>
          <Switch onValueChange={setShowCardCounts} value={showCardCounts} />
        </View>
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
  form: {
    marginTop: 40,
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
