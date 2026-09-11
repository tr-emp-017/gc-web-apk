import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  REACTION_OPTIONS,
  REACTION_SYMBOLS,
  type PublicPlayer,
  type ReactionId,
} from '@gadha-chor/shared-types';
import { AVATAR_IMAGES } from '../constants/avatarImages';
import { palette } from './Screen';

type ProfileModalProps = {
  readonly player: PublicPlayer | null;
  readonly onClose: () => void;
  readonly onSelectReaction: (reaction: ReactionId) => void;
  // Gates the "Request All Cards" row — hidden entirely rather than disabled when it doesn't
  // apply (self, spectating/left players, fewer than 3 active players, mid-chaal, etc.), same
  // rule the server independently re-validates.
  readonly canRequestCards: boolean;
  readonly isRequestingCards: boolean;
  readonly onRequestCards: () => void;
};

// The player-profile popup: opened by tapping any opponent's seat. Shows who they are and
// lets you throw a reaction at them or (when eligible) ask for their whole hand. Every
// reaction is free for now — no coins are deducted; the ₹0 tag is there so wiring in real
// pricing later is just changing that one label plus a server-side check, not a UI rework.
export function ProfileModal({
  player,
  onClose,
  onSelectReaction,
  canRequestCards,
  isRequestingCards,
  onRequestCards,
}: ProfileModalProps): React.JSX.Element {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={player !== null}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Close profile"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {player !== null && (
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>PROFILE</Text>
              <Pressable
                accessibilityLabel="Close profile"
                accessibilityRole="button"
                onPress={onClose}
                style={styles.closeButton}
              >
                <Ionicons color={palette.white} name="close" size={22} />
              </Pressable>
            </View>

            <View style={styles.body}>
              <View style={styles.profileColumn}>
                <View style={styles.avatarRing}>
                  <Image
                    resizeMode="cover"
                    source={AVATAR_IMAGES[player.avatar]}
                    style={styles.avatarImage}
                  />
                </View>
                <Text numberOfLines={1} style={styles.playerName}>
                  {player.name}
                </Text>
                <View style={styles.infoPill}>
                  <Ionicons color={palette.ink} name="albums-outline" size={14} />
                  <Text style={styles.infoPillText}>{player.cardsRemaining} cards left</Text>
                </View>
                {canRequestCards && (
                  <Pressable
                    accessibilityLabel={`Request all of ${player.name}'s cards`}
                    disabled={isRequestingCards}
                    onPress={onRequestCards}
                    style={[styles.requestButton, isRequestingCards && styles.requestButtonBusy]}
                  >
                    <Ionicons color={palette.white} name="flag" size={14} />
                    <Text style={styles.requestButtonText}>
                      {isRequestingCards ? 'Asking…' : 'Request all cards'}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.reactionGrid}>
                {REACTION_OPTIONS.map((reaction) => (
                  <Pressable
                    accessibilityLabel={`Send ${reaction} reaction to ${player.name}`}
                    key={reaction}
                    onPress={() => onSelectReaction(reaction)}
                    style={styles.reactionCell}
                  >
                    <Text style={styles.reactionEmoji}>{REACTION_SYMBOLS[reaction]}</Text>
                    <Text style={styles.reactionPrice}>FREE</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarRing: {
    borderRadius: 44,
    height: 88,
    overflow: 'hidden',
    width: 88,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(23, 33, 43, 0.6)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  body: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    padding: 20,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 20,
    maxWidth: 460,
    overflow: 'hidden',
    width: '100%',
  },
  closeButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  header: {
    alignItems: 'center',
    backgroundColor: palette.red,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  infoPill: {
    alignItems: 'center',
    backgroundColor: '#EFEBE2',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  infoPillText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  playerName: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
    maxWidth: 140,
    textAlign: 'center',
  },
  profileColumn: {
    alignItems: 'center',
    minWidth: 140,
  },
  reactionCell: {
    alignItems: 'center',
    backgroundColor: '#F3F0E8',
    borderRadius: 14,
    paddingVertical: 10,
    width: '31%',
  },
  reactionEmoji: {
    fontSize: 28,
  },
  reactionGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '3.5%',
    minWidth: 220,
  },
  reactionPrice: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  requestButton: {
    alignItems: 'center',
    backgroundColor: palette.red,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  requestButtonBusy: {
    opacity: 0.6,
  },
  requestButtonText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '800',
  },
});
