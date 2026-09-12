import { create } from 'zustand';
import type { AvatarId, PlayerAccount } from '@gadha-chor/shared-types';
import { randomUUID } from 'expo-crypto';
import {
  AccountApiError,
  checkUsernameAvailable,
  createAccount as apiCreateAccount,
  getOwnAccount,
  recoverAccount as apiRecoverAccount,
  regenerateRecoveryToken as apiRegenerateRecoveryToken,
  updateAccount as apiUpdateAccount,
} from '../api/accountApi';
import { clearCachedAccount, loadCachedAccount, saveCachedAccount } from '../utils/accountCache';
import { clearDeviceToken, loadDeviceToken, saveDeviceToken } from '../utils/deviceTokenStorage';

export type AccountStatus = 'loading' | 'needsSetup' | 'ready' | 'offline';

type AccountState = {
  readonly status: AccountStatus;
  readonly account: PlayerAccount | null;
  deviceToken: string | null;
  // Held only in memory, never persisted — the recovery token is meant to be shown to the
  // user exactly once (right after createAccount/regenerateRecoveryToken) and then forgotten
  // by the app entirely. The reveal screen reads this and the caller clears it on exit.
  readonly pendingRecoveryToken: string | null;
  clearPendingRecoveryToken: () => void;
  bootstrap: () => Promise<AccountStatus>;
  createAccount: (input: {
    username: string;
    displayName: string;
    avatar: AvatarId;
  }) => Promise<void>;
  updateAccount: (patch: {
    username?: string;
    displayName?: string;
    avatar?: AvatarId;
  }) => Promise<void>;
  recoverAccount: (recoveryToken: string) => Promise<void>;
  regenerateRecoveryToken: () => Promise<void>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
};

export const useAccountStore = create<AccountState>((set, get) => ({
  status: 'loading',
  account: null,
  deviceToken: null,
  pendingRecoveryToken: null,

  clearPendingRecoveryToken() {
    set({ pendingRecoveryToken: null });
  },

  async bootstrap() {
    const [deviceToken, cachedAccount] = await Promise.all([
      loadDeviceToken(),
      loadCachedAccount(),
    ]);
    if (deviceToken === null) {
      set({ status: 'needsSetup', account: null, deviceToken: null });
      return 'needsSetup';
    }
    try {
      const account = await getOwnAccount(deviceToken);
      await saveCachedAccount(account);
      set({ status: 'ready', account, deviceToken });
      return 'ready';
    } catch (error) {
      // Only a definitive "this credential is gone" response may clear local state — a
      // network failure, timeout, or 5xx (realistic here: Render free tier cold-starts, Neon
      // free tier auto-suspends) must not destroy a perfectly valid account. Fall back to the
      // cached copy and let the user keep playing offline instead.
      if (error instanceof AccountApiError && error.status === 401) {
        await clearDeviceToken();
        await clearCachedAccount();
        set({ status: 'needsSetup', account: null, deviceToken: null });
        return 'needsSetup';
      }
      if (cachedAccount !== null) {
        set({ status: 'offline', account: cachedAccount, deviceToken });
        return 'offline';
      }
      set({ status: 'needsSetup', account: null, deviceToken: null });
      return 'needsSetup';
    }
  },

  async createAccount(input) {
    const clientRequestId = randomUUID();
    const response = await apiCreateAccount({ ...input, clientRequestId });
    await saveDeviceToken(response.deviceToken);
    await saveCachedAccount(response.account);
    set({
      status: 'ready',
      account: response.account,
      deviceToken: response.deviceToken,
      pendingRecoveryToken: response.recoveryToken,
    });
  },

  async updateAccount(patch) {
    const { deviceToken } = get();
    if (deviceToken === null) {
      throw new Error('No account is signed in on this device.');
    }
    const account = await apiUpdateAccount(deviceToken, patch);
    await saveCachedAccount(account);
    set({ account });
  },

  async recoverAccount(recoveryToken) {
    const response = await apiRecoverAccount(recoveryToken);
    await saveDeviceToken(response.deviceToken);
    await saveCachedAccount(response.account);
    set({ status: 'ready', account: response.account, deviceToken: response.deviceToken });
  },

  async regenerateRecoveryToken() {
    const { deviceToken } = get();
    if (deviceToken === null) {
      throw new Error('No account is signed in on this device.');
    }
    const { recoveryToken } = await apiRegenerateRecoveryToken(deviceToken);
    set({ pendingRecoveryToken: recoveryToken });
  },

  async isUsernameAvailable(username) {
    return checkUsernameAvailable(username);
  },
}));
