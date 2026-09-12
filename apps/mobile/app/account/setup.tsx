import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
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

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const USERNAME_CHECK_DEBOUNCE_MS = 400;

export default function AccountSetupScreen(): React.JSX.Element {
  const router = useRouter();
  const createAccount = useAccountStore((state) => state.createAccount);
  const isUsernameAvailable = useAccountStore((state) => state.isUsernameAvailable);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('beard-glasses');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTokenRef = useRef(0);

  useEffect(() => {
    if (username.length === 0) {
      setUsernameStatus('idle');
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
          return; // A newer keystroke already superseded this check.
        }
        setUsernameStatus(available ? 'available' : 'taken');
      });
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [username, isUsernameAvailable]);

  const displayNameValid = displayName.length > 0 && isValidDisplayName(displayName);
  const canSubmit =
    usernameStatus === 'available' && displayNameValid && !isSubmitting;

  async function handleCreate(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await createAccount({ username, displayName: displayName.trim(), avatar });
      router.replace('/account/recovery-token');
    } catch (submitError) {
      setError(
        submitError instanceof AccountApiError
          ? submitError.message
          : 'Something went wrong creating your account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>WELCOME</Text>
      <Text style={styles.title}>Create your player profile</Text>
      <Text style={styles.description}>
        This is your permanent identity in Gadha Chor — pick a username and a display name.
        You'll get a secret recovery code afterward, so save it somewhere safe.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => setUsername(value.replace(/\s/g, ''))}
          placeholder="letters and numbers only"
          placeholderTextColor="#9A958B"
          style={styles.input}
          value={username}
        />
        <UsernameHint status={usernameStatus} />

        <Text style={styles.label}>Display name</Text>
        <TextInput
          autoCapitalize="words"
          maxLength={DISPLAY_NAME_MAX_LENGTH * 2}
          onChangeText={setDisplayName}
          placeholder="What players see at the table"
          placeholderTextColor="#9A958B"
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
          label={isSubmitting ? 'Creating...' : 'Create profile'}
          onPress={() => void handleCreate()}
        />
        <PrimaryButton
          label="Restore an existing account"
          onPress={() => router.push('/account/recover')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

function UsernameHint({ status }: { readonly status: UsernameStatus }): React.JSX.Element | null {
  switch (status) {
    case 'checking':
      return (
        <View style={styles.hintRow}>
          <ActivityIndicator color={palette.muted} size="small" />
          <Text style={styles.hint}>Checking availability…</Text>
        </View>
      );
    case 'available':
      return <Text style={styles.hintSuccess}>Available</Text>;
    case 'taken':
      return <Text style={styles.hintError}>That username is already taken.</Text>;
    case 'invalid':
      return (
        <Text style={styles.hintError}>3-16 letters/numbers, no spaces or symbols.</Text>
      );
    case 'idle':
    default:
      return <Text style={styles.hint}>3-16 letters/numbers, no spaces or symbols.</Text>;
  }
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
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
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
