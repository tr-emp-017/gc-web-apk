import { Screen, palette } from '../../src/components/Screen';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useEffect, useState } from 'react';
import { useRoomStore } from '../../src/stores/roomStore';
import { AVATAR_IMAGES } from '../../src/constants/avatarImages';
import type { PublicPlayer } from '@gadha-chor/shared-types';

export default function RoomLobbyScreen(): React.JSX.Element {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const room = useRoomStore((state) => state.room);
  const playerId = useRoomStore((state) => state.playerId);
  const gameState = useRoomStore((state) => state.gameState);
  const setReady = useRoomStore((state) => state.setReady);
  const startGame = useRoomStore((state) => state.startGame);
  const kickPlayer = useRoomStore((state) => state.kickPlayer);
  const error = useRoomStore((state) => state.error);
  const [playerToRemove, setPlayerToRemove] = useState<PublicPlayer | null>(null);

  const currentRoom = room?.code === code ? room : room;
  const currentPlayer = currentRoom?.players.find((player) => player.id === playerId);
  const isHost = currentPlayer?.isHost === true;
  const allReady = currentRoom?.players.every((player) => player.ready) === true;

  useEffect(() => {
    if (gameState?.status === 'PLAYING') {
      router.replace('/game');
    }
  }, [gameState?.status, router]);

  if (currentRoom === null) {
    return (
      <Screen>
        <Text style={styles.title}>Room unavailable</Text>
        <Text style={styles.description}>
          {error ?? 'This room session is no longer in the client.'}
        </Text>
        <PrimaryButton label="Back home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>GAME LOBBY</Text>
      <View style={styles.roomHeader}>
        <View>
          <Text style={styles.title}>Room ready</Text>
          <Text style={styles.description}>Waiting for everyone to take a seat.</Text>
        </View>
        <Text style={styles.code}>{currentRoom.code}</Text>
      </View>

      <View style={styles.playerList}>
        {currentRoom.players.map((player) => (
          <View key={player.id} style={styles.playerRow}>
            <View
              style={[styles.avatar, player.connected ? styles.connected : styles.disconnected]}
            >
              <Image resizeMode="cover" source={AVATAR_IMAGES[player.avatar]} style={styles.avatarImage} />
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerMeta}>
                {player.isHost ? 'Host' : player.ready ? 'Ready' : 'Not ready'}
              </Text>
            </View>
            <Text style={player.ready ? styles.ready : styles.waiting}>
              {player.ready ? 'READY' : 'WAITING'}
            </Text>
            {isHost && !player.isHost && (
              <Pressable
                accessibilityLabel={`Remove ${player.name} from the room`}
                accessibilityRole="button"
                onPress={() => setPlayerToRemove(player)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <Modal animationType="fade" transparent visible={playerToRemove !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.eyebrow}>REMOVE PLAYER</Text>
            <Text style={styles.title}>Remove {playerToRemove?.name ?? 'this player'}?</Text>
            <Text style={styles.description}>They can rejoin later with the room code.</Text>
            <View style={styles.actions}>
              <PrimaryButton
                label="Remove"
                onPress={() => {
                  if (playerToRemove !== null) {
                    void kickPlayer(playerToRemove.id);
                  }
                  setPlayerToRemove(null);
                }}
              />
              <PrimaryButton
                label="Cancel"
                onPress={() => setPlayerToRemove(null)}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        {isHost && (
          <PrimaryButton
            label="Start game"
            onPress={() => void startGame()}
            variant={allReady && currentRoom.players.length >= 3 ? 'primary' : 'secondary'}
          />
        )}
        {!isHost && (
          <PrimaryButton
            label={currentPlayer?.ready ? 'Mark not ready' : 'I am ready'}
            onPress={() => void setReady(!(currentPlayer?.ready ?? false))}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  code: {
    color: palette.red,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  connected: {
    borderColor: palette.red,
  },
  description: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  disconnected: {
    borderColor: palette.muted,
  },
  error: {
    color: palette.red,
    fontSize: 14,
    marginTop: 14,
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 33, 43, 0.6)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: palette.paper,
    borderRadius: 22,
    padding: 24,
    width: '100%',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerList: {
    backgroundColor: palette.white,
    borderRadius: 18,
    marginTop: 32,
    paddingHorizontal: 16,
  },
  playerMeta: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 3,
  },
  playerName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  playerRow: {
    alignItems: 'center',
    borderBottomColor: '#EEE9DF',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
  },
  ready: {
    color: '#3D8B5A',
    fontSize: 11,
    fontWeight: '800',
  },
  removeButton: {
    backgroundColor: '#F4E1DD',
    borderRadius: 10,
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: palette.red,
    fontSize: 11,
    fontWeight: '800',
  },
  roomHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  title: {
    color: palette.ink,
    fontSize: 38,
    fontWeight: '900',
  },
  waiting: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
  },
});
