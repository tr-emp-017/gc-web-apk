import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { AccountApiError } from '../../src/api/accountApi';
import { useAccountStore } from '../../src/stores/accountStore';

export default function RecoverAccountScreen(): React.JSX.Element {
  const router = useRouter();
  const recoverAccount = useAccountStore((state) => state.recoverAccount);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecover(): Promise<void> {
    if (recoveryToken.trim().length === 0) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await recoverAccount(recoveryToken);
      router.replace('/');
    } catch (submitError) {
      setError(
        submitError instanceof AccountApiError
          ? submitError.message
          : 'Something went wrong restoring your account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.eyebrow}>WELCOME BACK</Text>
      <Text style={styles.title}>Restore your account</Text>
      <Text style={styles.description}>
        Enter the recovery code you saved when you first created your profile. It works with or
        without the dashes.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Recovery code</Text>
        <TextInput
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setRecoveryToken}
          placeholder="GC-XXXX-XXXX-XXXX-XXXX"
          placeholderTextColor="#9A958B"
          style={styles.input}
          value={recoveryToken}
        />
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isSubmitting ? 'Restoring...' : 'Restore account'}
          onPress={() => void handleRecover()}
        />
        <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 32,
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
    marginTop: 32,
  },
  input: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 17,
    letterSpacing: 1,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 10,
  },
});
