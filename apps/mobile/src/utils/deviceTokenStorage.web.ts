// expo-secure-store has no web implementation, so the web build falls back to localStorage —
// mirrors sessionStorage.ts's existing web-only storage approach.
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
    // Ignore storage failures (private browsing, disabled storage, etc.).
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
