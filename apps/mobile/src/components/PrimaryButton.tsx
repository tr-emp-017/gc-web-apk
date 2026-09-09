import { Pressable, StyleSheet, Text } from 'react-native';
import { palette } from './Screen';

type PrimaryButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: 'primary' | 'secondary';
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
}: PrimaryButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondary : styles.primary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  primary: {
    backgroundColor: palette.red,
  },
  secondary: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderWidth: 1,
  },
  secondaryLabel: {
    color: palette.ink,
  },
});
