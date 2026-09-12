// Platform-specific implementations: deviceTokenStorage.native.ts (SecureStore) and
// deviceTokenStorage.web.ts (localStorage) — this file is the type-checked base signature and
// safe fallback for any other bundler target.
const STORAGE_KEY = 'gadha-chor-device-token';

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function saveDeviceToken(token: string): Promise<void> {
  try {
    getStorage()?.setItem(STORAGE_KEY, token);
  } catch {
    // Ignore storage failures.
  }
}

export async function loadDeviceToken(): Promise<string | null> {
  try {
    return getStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export async function clearDeviceToken(): Promise<void> {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
