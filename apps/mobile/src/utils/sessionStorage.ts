const STORAGE_KEY = 'gadha-chor-session';

export type StoredSession = { readonly code: string; readonly playerId: string };

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures (private browsing, disabled storage, native platform, etc.)
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Partial<StoredSession>).code === 'string' &&
      typeof (parsed as Partial<StoredSession>).playerId === 'string'
    ) {
      return parsed as StoredSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
