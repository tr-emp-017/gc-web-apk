import type {
  CreateAccountRequest,
  CreateAccountResponse,
  PlayerAccount,
  RecoverAccountResponse,
  RegenerateRecoveryTokenResponse,
  UpdateAccountRequest,
} from '@gadha-chor/shared-types';

const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:3000';

// Distinguishes a definitive "this credential is wrong/gone" response from anything else
// (network failure, timeout, 5xx) — accountStore.bootstrap's self-heal rule depends on this
// distinction to avoid wiping a valid account over a transient server hiccup.
export class AccountApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }

  get isDefinitive(): boolean {
    return this.status === 401 || this.status === 404 || this.status === 409 || this.status === 400;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (error) {
    throw new AccountApiError(error instanceof Error ? error.message : 'Network error.', null);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const message =
      typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed with status ${response.status}.`;
    throw new AccountApiError(message, response.status);
  }
  return (await response.json()) as T;
}

function authHeaders(deviceToken: string): Record<string, string> {
  return { Authorization: `Bearer ${deviceToken}` };
}

export function createAccount(input: CreateAccountRequest): Promise<CreateAccountResponse> {
  return request('/api/accounts', { method: 'POST', body: JSON.stringify(input) });
}

export async function getOwnAccount(deviceToken: string): Promise<PlayerAccount> {
  const { account } = await request<{ account: PlayerAccount }>('/api/accounts/me', {
    method: 'GET',
    headers: authHeaders(deviceToken),
  });
  return account;
}

export async function updateAccount(
  deviceToken: string,
  patch: UpdateAccountRequest,
): Promise<PlayerAccount> {
  const { account } = await request<{ account: PlayerAccount }>('/api/accounts/me', {
    method: 'PATCH',
    headers: authHeaders(deviceToken),
    body: JSON.stringify(patch),
  });
  return account;
}

export function recoverAccount(recoveryToken: string): Promise<RecoverAccountResponse> {
  return request('/api/accounts/recover', {
    method: 'POST',
    body: JSON.stringify({ recoveryToken }),
  });
}

export function regenerateRecoveryToken(
  deviceToken: string,
): Promise<RegenerateRecoveryTokenResponse> {
  return request('/api/accounts/recovery-token/regenerate', {
    method: 'POST',
    headers: authHeaders(deviceToken),
  });
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { available } = await request<{ available: boolean }>(
    `/api/accounts/username-available?u=${encodeURIComponent(username)}`,
    { method: 'GET' },
  );
  return available;
}
