import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PlayerAccount } from '@gadha-chor/shared-types';
import { AVATAR_IMAGES } from '../constants/avatarImages';
import { palette } from './Screen';

type PlayingAsCardProps = {
  readonly account: PlayerAccount;
};

// Replaces the old per-screen name/avatar inputs on the room create/join and bot setup
// screens now that there's a permanent account — your identity there is always the account's,
// with a tap-through to Edit Profile for anyone who wants to change it first.
export function PlayingAsCard({ account }: PlayingAsCardProps): React.JSX.Element {
  const router = useRouter();
  return (
    <Pressable
      accessibilityLabel="Edit your profile"
      accessibilityRole="button"
      onPress={() => router.push('/account/edit')}
      style={styles.card}
    >
      <Image resizeMode="cover" source={AVATAR_IMAGES[account.avatar]} style={styles.avatar} />
      <View style={styles.textWrap}>
        <Text style={styles.label}>Playing as</Text>
        <Text numberOfLines={1} style={styles.name}>
          {account.displayName}
        </Text>
      </View>
      <Ionicons color={palette.muted} name="create-outline" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  card: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  name: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  textWrap: {
    flex: 1,
  },
});
