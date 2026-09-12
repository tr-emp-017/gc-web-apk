import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlayerAccount } from '@gadha-chor/shared-types';

// Caches the last account we successfully fetched so the app can proceed with stale-but-valid
// data when GET /api/accounts/me fails for a reason that says nothing about whether the
// account still exists (offline, server cold-start, timeout) — see accountStore.bootstrap's
// self-heal rule. Never the source of truth; only ever a fallback.
const STORAGE_KEY = 'gadha-chor-cached-account';

export async function saveCachedAccount(account: PlayerAccount): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Ignore storage failures — worst case, a later offline boot has nothing to fall back to.
  }
}

export async function loadCachedAccount(): Promise<PlayerAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isPlayerAccountShaped(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearCachedAccount(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function isPlayerAccountShaped(value: unknown): value is PlayerAccount {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<PlayerAccount>).playerId === 'string' &&
    typeof (value as Partial<PlayerAccount>).username === 'string'
  );
}
