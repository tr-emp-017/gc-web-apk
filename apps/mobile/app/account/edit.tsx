import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AvatarId } from '@gadha-chor/shared-types';
import {
  DISPLAY_NAME_MAX_LENGTH,
  isValidDisplayName,
  isValidUsernameFormat,
} from '@gadha-chor/shared-utils';
import { AvatarPicker } from '../../src/components/AvatarPicker';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { Screen, palette } from '../../src/components/Screen';
import { AccountApiError } from '../../src/api/accountApi';
import { useAccountStore } from '../../src/stores/accountStore';
import { goBackOrHome } from '../../src/utils/goBackOrHome';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged';
const USERNAME_CHECK_DEBOUNCE_MS = 400;

export default function EditAccountScreen(): React.JSX.Element {
  const router = useRouter();
  const account = useAccountStore((state) => state.account);
  const updateAccount = useAccountStore((state) => state.updateAccount);
  const isUsernameAvailable = useAccountStore((state) => state.isUsernameAvailable);
  const regenerateRecoveryToken = useAccountStore((state) => state.regenerateRecoveryToken);

  const [username, setUsername] = useState(account?.username ?? '');
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [avatar, setAvatar] = useState<AvatarId>(account?.avatar ?? 'beard-glasses');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('unchanged');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTokenRef = useRef(0);

  useEffect(() => {
    if (account === null || username === account.username) {
      setUsernameStatus('unchanged');
      return;
    }
    if (!isValidUsernameFormat(username)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const token = ++checkTokenRef.current;
    const timer = setTimeout(() => {
      void isUsernameAvailable(username).then((available) => {
        if (checkTokenRef.current !== token) {
          return;
        }
        setUsernameStatus(available ? 'available' : 'taken');
      });
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [username, account, isUsernameAvailable]);

  if (account === null) {
    return (
      <Screen>
        <Text style={styles.title}>No account found.</Text>
      </Screen>
    );
  }

  const displayNameValid = displayName.length > 0 && isValidDisplayName(displayName);
  const usernameOk = usernameStatus === 'available' || usernameStatus === 'unchanged';
  const canSubmit = usernameOk && displayNameValid && !isSubmitting;

  async function handleSave(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await updateAccount({
        ...(username !== account?.username ? { username } : {}),
        displayName: displayName.trim(),
        avatar,
      });
      goBackOrHome(router);
    } catch (submitError) {
      setError(
        submitError instanceof AccountApiError
          ? submitError.message
          : 'Something went wrong saving your profile.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRegeneratePress(): void {
    Alert.alert(
      'Regenerate recovery code?',
      'Your current recovery code will stop working immediately. You will see the new one exactly once, so save it right away.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void regenerateRecoveryToken().then(() => router.push('/account/recovery-token'));
          },
          style: 'destructive',
          text: 'Regenerate',
        },
      ],
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>YOUR PROFILE</Text>
      <Text style={styles.title}>Edit profile</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => setUsername(value.replace(/\s/g, ''))}
          style={styles.input}
          value={username}
        />
        <UsernameHint status={usernameStatus} />

        <Text style={styles.label}>Display name</Text>
        <TextInput
          autoCapitalize="words"
          maxLength={DISPLAY_NAME_MAX_LENGTH * 2}
          onChangeText={setDisplayName}
          style={styles.input}
          value={displayName}
        />
        {displayName.length > 0 && !displayNameValid && (
          <Text style={styles.hintError}>Max {DISPLAY_NAME_MAX_LENGTH} characters.</Text>
        )}

        <AvatarPicker onChange={setAvatar} value={avatar} />
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={isSubmitting ? 'Saving...' : 'Save changes'}
          onPress={() => void handleSave()}
        />
        <PrimaryButton
          label="Regenerate recovery code"
          onPress={handleRegeneratePress}
          variant="secondary"
        />
        <PrimaryButton label="Back" onPress={() => goBackOrHome(router)} variant="secondary" />
      </View>
    </Screen>
  );
}

function UsernameHint({ status }: { readonly status: UsernameStatus }): React.JSX.Element | null {
  switch (status) {
    case 'checking':
      return <Text style={styles.hint}>Checking availability…</Text>;
    case 'available':
      return <Text style={styles.hintSuccess}>Available</Text>;
    case 'taken':
      return <Text style={styles.hintError}>That username is already taken.</Text>;
    case 'invalid':
      return <Text style={styles.hintError}>3-16 letters/numbers, no spaces or symbols.</Text>;
    case 'unchanged':
    case 'idle':
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 32,
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
  hint: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 6,
  },
  hintError: {
    color: palette.red,
    fontSize: 12,
    marginTop: 6,
  },
  hintSuccess: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 14,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 17,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 20,
  },
  title: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 10,
  },
});
