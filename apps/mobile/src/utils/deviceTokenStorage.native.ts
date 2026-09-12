import * as SecureStore from 'expo-secure-store';

// The device token is the bearer credential that authorizes every account read/write from
// this device — kept in the OS keychain/keystore (via SecureStore) rather than AsyncStorage,
// unlike the merely-convenient data in accountCache.ts.
const STORAGE_KEY = 'gadha-chor-device-token';

export async function saveDeviceToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, token);
  } catch {
    // Ignore storage failures — the caller falls back to treating this as "not signed in".
  }
}

export async function loadDeviceToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function clearDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
