import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AVATAR_OPTIONS, AVATAR_SYMBOLS, type AvatarId } from '@gadha-chor/shared-types';
import { palette } from './Screen';

type AvatarPickerProps = {
  readonly value: AvatarId;
  readonly onChange: (avatar: AvatarId) => void;
};

export function AvatarPicker({ value, onChange }: AvatarPickerProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choose your icon</Text>
      <View style={styles.options}>
        {AVATAR_OPTIONS.map((avatar) => (
          <Pressable
            accessibilityLabel={`Select ${avatar} avatar`}
            accessibilityRole="button"
            key={avatar}
            onPress={() => onChange(avatar)}
            style={[styles.option, avatar === value && styles.selected]}
          >
            <Text style={styles.symbol}>{AVATAR_SYMBOLS[avatar]}</Text>
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
  option: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 16,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  options: {
    flexDirection: 'row',
    gap: 10,
  },
  selected: {
    backgroundColor: '#F5D8A4',
    borderColor: palette.red,
    borderWidth: 2,
  },
  symbol: {
    color: palette.ink,
    fontSize: 25,
  },
});
