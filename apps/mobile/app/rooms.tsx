import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { Screen, palette } from '../src/components/Screen';
import { AVATAR_IMAGES } from '../src/constants/avatarImages';
import { useRoomStore } from '../src/stores/roomStore';
import { useAccountStore } from '../src/stores/accountStore';
import { goBackOrHome } from '../src/utils/goBackOrHome';
import type { RoomListing } from '@gadha-chor/shared-types';

type LoadState = 'loading' | 'ready' | 'error';

export default function RoomsScreen(): React.JSX.Element {
  const router = useRouter();
  const listRooms = useRoomStore((state) => state.listRooms);
  const joinRoom = useRoomStore((state) => state.joinRoom);
  // Read live from the store — kept current by the 'rooms:updated' broadcast for as long as
  // the socket stays connected, so this list updates on its own with no manual refresh.
  const rooms = useRoomStore((state) => state.roomListings);
  const account = useAccountStore((state) => state.account);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [joiningCode, setJoiningCode] = useState<string | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoadState('loading');
    listRooms()
      .then(() => {
        if (!cancelled) {
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
  }, [listRooms]);

  useFocusEffect(refresh);

  async function handleJoinPublic(code: string): Promise<void> {
    if (account === null) {
      return;
    }
    setJoiningCode(code);
    const joined = await joinRoom(code, account.displayName, account.avatar);
    setJoiningCode(null);
    if (joined) {
      router.replace(`/room/${code}`);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>OPEN TABLES</Text>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => goBackOrHome(router)}
          style={styles.topBackButton}
        >
          <Ionicons color={palette.ink} name="arrow-back" size={20} />
        </Pressable>
      </View>

      <Text style={styles.title}>Rooms</Text>
      <Text style={styles.description}>
        Public tables join instantly. Private ones still need the host's code.
      </Text>

      {loadState === 'loading' && (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={palette.red} size="large" />
        </View>
      )}

      {loadState === 'error' && (
        <View style={styles.centerWrap}>
          <Text style={styles.error}>Couldn't load rooms. Check your connection.</Text>
        </View>
      )}

      {loadState === 'ready' && rooms.length === 0 && (
        <View style={styles.centerWrap}>
          <Text style={styles.empty}>No open tables right now.</Text>
        </View>
      )}

      {loadState === 'ready' && rooms.length > 0 && (
        <View style={styles.list}>
          {rooms.map((room, index) => (
            <RoomRow
              isJoining={joiningCode === room.code}
              key={`${room.code ?? 'private'}-${index}`}
              onJoinPublic={handleJoinPublic}
              onOpenPrivate={() => router.push('/room/join')}
              room={room}
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

function RoomRow({
  room,
  isJoining,
  onJoinPublic,
  onOpenPrivate,
}: {
  readonly room: RoomListing;
  readonly isJoining: boolean;
  readonly onJoinPublic: (code: string) => void;
  readonly onOpenPrivate: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Image resizeMode="cover" source={AVATAR_IMAGES[room.hostAvatar]} style={styles.avatar} />
      <View style={styles.nameWrap}>
        <Text numberOfLines={1} style={styles.name}>
          {room.hostName}&apos;s table
        </Text>
        <Text style={styles.meta}>
          {room.targetPlayerCount !== undefined
            ? `${room.playerCount}/${room.targetPlayerCount} players`
            : `${room.playerCount} players`}
        </Text>
      </View>
      {room.isPublic && room.code !== undefined ? (
        <Pressable
          accessibilityLabel={`Join ${room.hostName}'s table`}
          accessibilityRole="button"
          disabled={isJoining}
          onPress={() => onJoinPublic(room.code as string)}
          style={[styles.joinButton, isJoining && styles.joinButtonBusy]}
        >
          <Text style={styles.joinButtonText}>{isJoining ? 'Joining...' : 'Join'}</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityLabel="Enter the room code to join this private table"
          accessibilityRole="button"
          onPress={onOpenPrivate}
          style={styles.privateButton}
        >
          <Ionicons color={palette.muted} name="lock-closed" size={14} />
          <Text style={styles.privateButtonText}>Enter code</Text>
        </Pressable>
      )}
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
    paddingVertical: 40,
  },
  description: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 8,
  },
  empty: {
    color: palette.muted,
    fontSize: 14,
    textAlign: 'center',
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
  joinButton: {
    backgroundColor: palette.red,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinButtonBusy: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 8,
    paddingBottom: 16,
    paddingTop: 20,
  },
  meta: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  name: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  nameWrap: {
    flex: 1,
    marginLeft: 10,
  },
  privateButton: {
    alignItems: 'center',
    backgroundColor: '#F3F0E8',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  privateButtonText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
});
