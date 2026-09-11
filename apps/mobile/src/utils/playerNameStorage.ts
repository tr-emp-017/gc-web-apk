import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers the player's last-used display name on this device only — there's no account
// system or server-side profile, so this is purely a local convenience (backed by
// localStorage on web, native device storage on iOS/Android via AsyncStorage).
const STORAGE_KEY = 'gadha-chor-player-name';

export async function savePlayerName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Ignore storage failures (private browsing, disabled storage, etc.) — the name simply
    // won't be remembered next time.
  }
}

export async function loadPlayerName(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored !== null && stored.trim().length > 0 ? stored : null;
  } catch {
    return null;
  }
}
