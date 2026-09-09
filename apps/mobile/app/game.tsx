import { Screen, palette } from '../src/components/Screen';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { PlayingCard, SUIT_SYMBOLS } from '../src/components/PlayingCard';
import { DraggableHand } from '../src/components/DraggableHand';

import {
  AVATAR_SYMBOLS,
  REACTION_OPTIONS,
  REACTION_SYMBOLS,
  type PublicPlayer,
  type ReactionId,
} from '@gadha-chor/shared-types';
import { useRoomStore } from '../src/stores/roomStore';
import { useVoice } from '../src/voice/useVoice';

const statusBadgeLabels: Record<'SPECTATING' | 'LEFT', string> = {
  LEFT: 'LEFT',
  SPECTATING: 'WATCHING',
};

type SeatPosition = { readonly x: number; readonly y: number };

const OPPONENT_SEAT_LAYOUTS: Record<number, readonly SeatPosition[]> = {
  1: [{ x: 50, y: 10 }],
  2: [
    { x: 22, y: 14 },
    { x: 78, y: 14 },
  ],
  3: [
    { x: 8, y: 46 },
    { x: 50, y: 8 },
    { x: 92, y: 46 },
  ],
  4: [
    { x: 8, y: 24 },
    { x: 33, y: 6 },
    { x: 67, y: 6 },
    { x: 92, y: 24 },
  ],
  5: [
    { x: 6, y: 40 },
    { x: 22, y: 8 },
    { x: 50, y: 2 },
    { x: 78, y: 8 },
    { x: 94, y: 40 },
  ],
};

const ME_SEAT: SeatPosition = { x: 50, y: 96 };

function clampDeg(value: number): number {
  return Math.max(-20, Math.min(20, value));
}

export default function GameTableScreen(): React.JSX.Element {
  const router = useRouter();
  const room = useRoomStore((state) => state.room);
  const gameState = useRoomStore((state) => state.gameState);
  const playerId = useRoomStore((state) => state.playerId);
  const playCard = useRoomStore((state) => state.playCard);
  const reactToPlayer = useRoomStore((state) => state.reactToPlayer);
  const latestReaction = useRoomStore((state) => state.latestReaction);
  const walletBalance = useRoomStore((state) => state.walletBalance);
  const leaveGame = useRoomStore((state) => state.leaveGame);
  const spectateGame = useRoomStore((state) => state.spectateGame);
  const exitGame = useRoomStore((state) => state.exitGame);
  const returnHome = useRoomStore((state) => state.returnHome);
  const error = useRoomStore((state) => state.error);
  const { isMuted, isSpeakerEnabled, toggleMuted, toggleSpeaker, unavailable } = useVoice();
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [sortSignal, setSortSignal] = useState(0);
  const [suitSortSignal, setSuitSortSignal] = useState(0);
  const showCardCounts = room?.showCardCounts ?? false;

  if (gameState === null) {
    return (
      <Screen>
        <Text style={styles.title}>Waiting for the table</Text>
        <Text style={styles.muted}>The server has not sent a game state yet.</Text>
      </Screen>
    );
  }

  if (gameState.status === 'GAME_OVER') {
    const gadhaChor = gameState.players.find((player) => player.id === gameState.gadhaChorId);
    return (
      <Screen>
        <Text style={styles.eyebrow}>GAME OVER</Text>
        <Text style={styles.title}>
          {gadhaChor?.id === playerId
            ? 'You are the Gadha Chor'
            : `${gadhaChor?.name ?? 'A player'} is the Gadha Chor`}
        </Text>
        {walletBalance !== null && (
          <Text style={styles.muted}>Your balance: {walletBalance} coins</Text>
        )}
        <View style={styles.actions}>
          <PrimaryButton
            label="Back to home"
            onPress={() => {
              returnHome();
              router.replace('/');
            }}
          />
        </View>
      </Screen>
    );
  }

  const myPlayer = gameState.players.find((player) => player.id === playerId);
  const showPostGameChoice = myPlayer?.status === 'FINISHED';
  const isMyTurn = gameState.currentPlayerId === playerId;
  const currentPlayer = gameState.players.find((player) => player.id === gameState.currentPlayerId);
  const opponents = gameState.players.filter((player) => player.id !== playerId);
  const seatFor = (player: PublicPlayer): SeatPosition => {
    if (player.id === playerId) {
      return ME_SEAT;
    }
    const index = opponents.findIndex((opponent) => opponent.id === player.id);
    const layout = OPPONENT_SEAT_LAYOUTS[opponents.length] ?? OPPONENT_SEAT_LAYOUTS[5];
    return layout?.[index] ?? { x: 50, y: 10 };
  };

  function handleExitTable(): void {
    const action = myPlayer?.status === 'ACTIVE' ? exitGame : leaveGame;
    void action().finally(() => router.replace('/'));
  }

  return (
    <Screen scroll>
      <Modal animationType="fade" transparent visible={showPostGameChoice}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.eyebrow}>YOU FINISHED!</Text>
            <Text style={styles.title}>You&apos;re a winner</Text>
            {walletBalance !== null && (
              <Text style={styles.muted}>Your balance: {walletBalance} coins</Text>
            )}
            <View style={styles.actions}>
              <PrimaryButton
                label={isLeaving ? 'Leaving...' : 'Leave game'}
                onPress={() => {
                  setIsLeaving(true);
                  void leaveGame().then((left) => {
                    setIsLeaving(false);
                    if (left) {
                      router.replace('/');
                    }
                  });
                }}
              />
              <PrimaryButton
                label="Stay and watch"
                onPress={() => void spectateGame()}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.topline}>
        <View>
          <Text style={styles.eyebrow}>GADHA CHOR</Text>
          <Text style={styles.title}>Your table</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.turnBadge}>
            <Text style={styles.turnLabel}>
              {isMyTurn ? 'YOUR TURN' : `${currentPlayer?.name ?? 'Player'}'S TURN`}
            </Text>
          </View>
          {!unavailable && (
            <>
              <Pressable
                accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                accessibilityRole="button"
                onPress={toggleMuted}
                style={styles.voiceIconButton}
              >
                <Ionicons
                  color={isMuted ? palette.muted : palette.red}
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={16}
                />
              </Pressable>
              <Pressable
                accessibilityLabel={isSpeakerEnabled ? 'Turn speaker off' : 'Turn speaker on'}
                accessibilityRole="button"
                onPress={toggleSpeaker}
                style={styles.voiceIconButton}
              >
                <Ionicons
                  color={isSpeakerEnabled ? palette.red : palette.muted}
                  name={isSpeakerEnabled ? 'volume-high' : 'volume-mute'}
                  size={16}
                />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {latestReaction !== null && (
        <View style={styles.reactionToast}>
          <Text style={styles.reactionToastText}>
            {gameState.players.find((player) => player.id === latestReaction.fromPlayerId)?.name ??
              'Player'}
            {' sent '}
            {REACTION_SYMBOLS[latestReaction.reaction]}
            {' to '}
            {gameState.players.find((player) => player.id === latestReaction.targetPlayerId)
              ?.name ?? 'Player'}
          </Text>
        </View>
      )}

      <View style={styles.tableWrap}>
        <Pressable
          accessibilityLabel="Leave the table"
          accessibilityRole="button"
          onPress={handleExitTable}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
        <View style={styles.trophyButton}>
          <Text style={styles.trophyIcon}>🏆</Text>
        </View>

        {opponents.map((player) => {
          const seat = seatFor(player);
          const isTurn = player.id === gameState.currentPlayerId;
          const isOut = player.status === 'SPECTATING' || player.status === 'LEFT';
          const fanCount = Math.max(1, Math.min(player.cardsRemaining, 5));
          return (
            <Pressable
              key={player.id}
              onPress={() =>
                setReactionTargetId((current) => (current === player.id ? null : player.id))
              }
              style={[styles.seat, { left: `${seat.x}%`, top: `${seat.y}%` }]}
            >
              <View
                style={[
                  styles.playerAvatar,
                  isTurn && styles.activeAvatar,
                  isOut && styles.outAvatar,
                ]}
              >
                <Text style={styles.playerAvatarText}>{AVATAR_SYMBOLS[player.avatar]}</Text>
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                numberOfLines={1}
                style={styles.playerName}
              >
                {player.name}
              </Text>
              {isTurn && <Text style={styles.turnText}>TURN</Text>}
              {player.status === 'FINISHED' && <Text style={styles.wonText}>WON</Text>}
              {isOut && (
                <Text style={styles.outText}>
                  {statusBadgeLabels[player.status as 'SPECTATING' | 'LEFT']}
                </Text>
              )}
              {!isOut && player.cardsRemaining > 0 && (
                <View style={styles.seatCardFan}>
                  {Array.from({ length: fanCount }).map((_, fanIndex) => (
                    <PlayingCard
                      faceDown
                      key={fanIndex}
                      rotateDeg={(fanIndex - (fanCount - 1) / 2) * 8}
                      size="mini"
                      style={[styles.fanCard, { marginLeft: fanIndex === 0 ? 0 : -18 }]}
                    />
                  ))}
                  {showCardCounts && (
                    <View style={styles.cardCountBadge}>
                      <Text style={styles.cardCountText}>{player.cardsRemaining}</Text>
                    </View>
                  )}
                </View>
              )}
              {reactionTargetId === player.id && (
                <View style={styles.reactionOptions}>
                  {REACTION_OPTIONS.map((reaction) => (
                    <Pressable
                      accessibilityLabel={`Send ${reaction} reaction to ${player.name}`}
                      key={reaction}
                      onPress={() => {
                        void reactToPlayer(player.id, reaction as ReactionId);
                        setReactionTargetId(null);
                      }}
                      style={styles.reactionButton}
                    >
                      <Text style={styles.reactionSymbol}>{REACTION_SYMBOLS[reaction]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}

        <View style={styles.centerPlayArea}>
          {gameState.currentChaal.length === 0 ? (
            <Text style={styles.tableMessage}>The next leader chooses a card.</Text>
          ) : (
            gameState.currentChaal.map((playedCard) => {
              const player = gameState.players.find((p) => p.id === playedCard.playerId);
              const seat = player !== undefined ? seatFor(player) : ME_SEAT;
              const centerX = 50 + (seat.x - 50) * 0.45;
              const centerY = 50 + (seat.y - 50) * 0.45;
              const rotateDeg = clampDeg((seat.x - 50) * 0.35);
              return (
                <PlayingCard
                  card={playedCard.card}
                  key={`${playedCard.playerId}-${playedCard.card.id}`}
                  rotateDeg={rotateDeg}
                  size="played"
                  style={[
                    styles.playedCard,
                    {
                      left: `${centerX}%`,
                      top: `${centerY}%`,
                      marginLeft: -26,
                      marginTop: -37,
                    },
                  ]}
                />
              );
            })
          )}
        </View>
      </View>

      {gameState.requiredSuit !== undefined && (
        <Text style={styles.required}>Required suit: {SUIT_SYMBOLS[gameState.requiredSuit]}</Text>
      )}

      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={styles.handHeaderRow}>
        <Text style={styles.handLabel}>YOUR HAND · {gameState.ownCards.length} CARDS</Text>
        <View style={styles.sortButtonGroup}>
          <Pressable
            accessibilityLabel="Reorder cards from highest to lowest"
            accessibilityRole="button"
            onPress={() => setSortSignal((current) => current + 1)}
            style={styles.sortButton}
          >
            <Text style={styles.sortButtonText}>Sort ↓</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Group cards by suit: spades, hearts, clubs, diamonds"
            accessibilityRole="button"
            onPress={() => setSuitSortSignal((current) => current + 1)}
            style={styles.sortButton}
          >
            <Text style={styles.sortButtonText}>Sort by suit</Text>
          </Pressable>
        </View>
      </View>
      <DraggableHand
        canPlay={isMyTurn}
        cards={gameState.ownCards}
        onPlay={(cardId) => void playCard(cardId)}
        sortSignal={sortSignal}
        suitSortSignal={suitSortSignal}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 24,
  },
  activeAvatar: {
    backgroundColor: palette.red,
  },
  cardCountBadge: {
    backgroundColor: palette.ink,
    borderRadius: 9,
    marginLeft: 4,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cardCountText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerPlayArea: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: palette.red,
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    left: 10,
    position: 'absolute',
    top: 10,
    width: 32,
    zIndex: 10,
  },
  closeButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '900',
  },
  error: {
    color: palette.red,
    fontSize: 13,
    marginTop: 10,
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  fanCard: {
    borderColor: '#5E1620',
  },
  handHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  handLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
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
  muted: {
    color: palette.muted,
    fontSize: 16,
    marginTop: 10,
  },
  outAvatar: {
    backgroundColor: '#D9D3C6',
  },
  outText: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  playedCard: {
    position: 'absolute',
  },
  playerAvatar: {
    alignItems: 'center',
    backgroundColor: '#D9E4D5',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  playerAvatarText: {
    color: palette.ink,
    fontSize: 20,
  },
  playerName: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    maxWidth: 96,
    textAlign: 'center',
  },
  reactionButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  reactionOptions: {
    backgroundColor: '#F5D8A4',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 3,
    marginTop: 5,
    padding: 3,
    position: 'absolute',
    top: 70,
    zIndex: 5,
  },
  reactionSymbol: {
    fontSize: 16,
  },
  reactionToast: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: 'absolute',
    right: 24,
    shadowColor: '#17212B',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    top: 56,
    zIndex: 20,
  },
  reactionToastText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  required: {
    color: palette.saffron,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  seat: {
    alignItems: 'center',
    marginLeft: -48,
    marginTop: -18,
    position: 'absolute',
    width: 96,
    zIndex: 3,
  },
  sortButton: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButtonText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  seatCardFan: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 6,
  },
  tableMessage: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
  },
  tableWrap: {
    backgroundColor: '#7A5233',
    borderColor: '#5C3D26',
    borderRadius: 24,
    borderWidth: 6,
    height: 260,
    marginTop: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  topline: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trophyButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    zIndex: 10,
  },
  trophyIcon: {
    fontSize: 16,
  },
  turnBadge: {
    backgroundColor: '#F5D8A4',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  turnLabel: {
    color: palette.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  turnText: {
    color: palette.saffron,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
  voiceIconButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  wonText: {
    color: palette.saffron,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
  },
});
