import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { useAccountStore } from '../../src/stores/accountStore';

export default function RecoveryTokenScreen(): React.JSX.Element {
  const router = useRouter();
  const pendingRecoveryToken = useAccountStore((state) => state.pendingRecoveryToken);
  const clearPendingRecoveryToken = useAccountStore((state) => state.clearPendingRecoveryToken);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Block Android's hardware back button until the user confirms they've saved the token —
  // otherwise this one-time reveal is trivially skippable.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => !confirmed);
    return () => subscription.remove();
  }, [confirmed]);

  function handleContinue(): void {
    clearPendingRecoveryToken();
    router.replace('/');
  }

  async function handleCopy(): Promise<void> {
    if (pendingRecoveryToken === null) {
      return;
    }
    await Clipboard.setStringAsync(pendingRecoveryToken);
    setCopied(true);
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>SAVE THIS NOW</Text>
      <Text style={styles.title}>Your recovery code</Text>
      <Text style={styles.description}>
        This is the only time you'll see this code. Write it down or save it somewhere safe —
        it's the only way to restore your account if you reinstall the app or switch phones.
      </Text>

      <View style={styles.tokenBox}>
        <Text style={styles.tokenText}>{pendingRecoveryToken ?? '—'}</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => void handleCopy()} style={styles.copyButton}>
        <Ionicons color={palette.red} name={copied ? 'checkmark' : 'copy-outline'} size={18} />
        <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy to clipboard'}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed((value) => !value)}
        style={styles.confirmRow}
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
          {confirmed && <Ionicons color={palette.white} name="checkmark" size={16} />}
        </View>
        <Text style={styles.confirmText}>I've saved this recovery code securely</Text>
      </Pressable>

      <View style={styles.actions}>
        <PrimaryButton
          label="Continue"
          onPress={() => {
            if (confirmed) {
              handleContinue();
            }
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#DED8CC',
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: palette.red,
    borderColor: palette.red,
  },
  confirmRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  confirmText: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  copyButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
  },
  copyButtonText: {
    color: palette.red,
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
  },
  eyebrow: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 10,
  },
  tokenBox: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  tokenText: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
