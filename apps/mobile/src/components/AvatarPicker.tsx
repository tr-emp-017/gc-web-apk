import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AVATAR_OPTIONS, type AvatarId } from '@gadha-chor/shared-types';
import { AVATAR_IMAGES } from '../constants/avatarImages';
import { palette } from './Screen';

type AvatarPickerProps = {
  readonly value: AvatarId;
  readonly onChange: (avatar: AvatarId) => void;
};

export function AvatarPicker({ value, onChange }: AvatarPickerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choose your avatar</Text>
      <View style={styles.options}>
        {AVATAR_OPTIONS.map((avatar) => (
          <Pressable
            accessibilityLabel={`Select ${avatar} avatar`}
            accessibilityRole="button"
            key={avatar}
            onPress={() => onChange(avatar)}
            style={[styles.option, avatar === value && styles.selected]}
          >
            <Image resizeMode="cover" source={AVATAR_IMAGES[avatar]} style={styles.image} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  option: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 16,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 50,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selected: {
    backgroundColor: '#F5D8A4',
    borderColor: palette.red,
    borderWidth: 2,
  },
});
