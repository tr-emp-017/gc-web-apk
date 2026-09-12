import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AccountNotFoundError,
  InvalidCredentialError,
  UsernameTakenError,
  ValidationError,
} from './accountErrors.js';
import { InMemoryPlayerAccountRepository } from './InMemoryPlayerAccountRepository.js';
import { PlayerAccountService } from './PlayerAccountService.js';

function newService(): PlayerAccountService {
  return new PlayerAccountService(new InMemoryPlayerAccountRepository());
}

function newServiceWithRepo(): {
  service: PlayerAccountService;
  repository: InMemoryPlayerAccountRepository;
} {
  const repository = new InMemoryPlayerAccountRepository();
  return { repository, service: new PlayerAccountService(repository) };
}

function seedBot(
  repository: InMemoryPlayerAccountRepository,
  overrides: Partial<{ playerId: string; displayName: string; wins: number; losses: number }> = {},
) {
  const now = new Date();
  const record = {
    avatar: 'donkey' as never,
    createdAt: now,
    deviceTokenHash: randomUUID(),
    displayName: overrides.displayName ?? 'BotOne',
    gamesPlayed: (overrides.wins ?? 0) + (overrides.losses ?? 0),
    isBot: true,
    losses: overrides.losses ?? 0,
    playerId: overrides.playerId ?? randomUUID(),
    recoveryTokenHash: randomUUID(),
    updatedAt: now,
    username: (overrides.displayName ?? 'botone').toLowerCase(),
    wins: overrides.wins ?? 0,
  };
  repository.seedBotAccountForTest(record);
  return record;
}

async function createTestAccount(
  service: PlayerAccountService,
  overrides: Partial<{ username: string; displayName: string; avatar: string }> = {},
) {
  return service.createAccount({
    username: overrides.username ?? 'aslam123',
    displayName: overrides.displayName ?? 'Aslam',
    avatar: (overrides.avatar ?? 'beard-glasses') as never,
    clientRequestId: randomUUID(),
  });
}

describe('PlayerAccountService.createAccount', () => {
  it('creates an account and returns a recovery token and device token exactly once', async () => {
    const service = newService();
    const result = await createTestAccount(service);

    expect(result.account.username).toBe('aslam123');
    expect(result.account.displayName).toBe('Aslam');
    expect(result.account.avatar).toBe('beard-glasses');
    expect(result.account.gamesPlayed).toBe(0);
    expect(result.account.wins).toBe(0);
    expect(result.account.losses).toBe(0);
    expect(result.recoveryToken).toMatch(/^GC-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(result.deviceToken.length).toBeGreaterThan(20);
    expect(result.account.playerId).toBeDefined();
  });

  it('rejects a duplicate username case-insensitively', async () => {
    const service = newService();
    await createTestAccount(service, { username: 'PlayerOne' });

    await expect(createTestAccount(service, { username: 'playerone' })).rejects.toBeInstanceOf(
      UsernameTakenError,
    );
  });

  it.each([
    ['has a space', 'player one'],
    ['has a special character', 'player!'],
    ['is too short', 'ab'],
    ['is too long', 'a'.repeat(17)],
    ['is a reserved word', 'admin'],
  ])('rejects a username that %s', async (_label, username) => {
    const service = newService();
    await expect(createTestAccount(service, { username })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a display name longer than 15 characters, counting emoji as one character', async () => {
    const service = newService();
    const fifteenEmoji = '😀'.repeat(15);
    await expect(
      createTestAccount(service, { displayName: fifteenEmoji + '😀' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createTestAccount(service, { displayName: fifteenEmoji })).resolves.toBeDefined();
  });

  it('rejects an unknown avatar', async () => {
    const service = newService();
    await expect(
      createTestAccount(service, { avatar: 'not-a-real-avatar' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('is idempotent under the same clientRequestId (retry after a lost response)', async () => {
    const service = newService();
    const clientRequestId = randomUUID();
    const first = await service.createAccount({
      username: 'retryuser',
      displayName: 'Retry',
      avatar: 'donkey' as never,
      clientRequestId,
    });
    const second = await service.createAccount({
      username: 'retryuser',
      displayName: 'Retry',
      avatar: 'donkey' as never,
      clientRequestId,
    });
    expect(second.account.playerId).toBe(first.account.playerId);
  });
});

describe('PlayerAccountService.getOwnAccount / updateProfile', () => {
  it('fetches the account for a valid device token', async () => {
    const service = newService();
    const { deviceToken, account } = await createTestAccount(service);
    const fetched = await service.getOwnAccount(deviceToken);
    expect(fetched.playerId).toBe(account.playerId);
  });

  it('rejects an invalid device token', async () => {
    const service = newService();
    await expect(service.getOwnAccount('not-a-real-token')).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
  });

  it('updates username/displayName/avatar for the token owner', async () => {
    const service = newService();
    const { deviceToken } = await createTestAccount(service);
    const updated = await service.updateProfile(deviceToken, {
      username: 'newname1',
      displayName: 'New Name',
      avatar: 'wink-tongue' as never,
    });
    expect(updated.username).toBe('newname1');
    expect(updated.displayName).toBe('New Name');
    expect(updated.avatar).toBe('wink-tongue');
  });

  it('does not false-conflict when updating other fields without changing username', async () => {
    const service = newService();
    const { deviceToken } = await createTestAccount(service, { username: 'stableuser' });
    const updated = await service.updateProfile(deviceToken, {
      username: 'stableuser',
      displayName: 'Still Me',
    });
    expect(updated.displayName).toBe('Still Me');
  });

  it('rejects updating to a username someone else already has', async () => {
    const service = newService();
    await createTestAccount(service, { username: 'takenname' });
    const { deviceToken } = await createTestAccount(service, { username: 'otheruser' });
    await expect(
      service.updateProfile(deviceToken, { username: 'takenname' }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it('rejects an update with no valid device token', async () => {
    const service = newService();
    await expect(
      service.updateProfile('bogus-token', { displayName: 'Nope' }),
    ).rejects.toBeInstanceOf(InvalidCredentialError);
  });
});

describe('PlayerAccountService.recoverAccount', () => {
  it('restores the account and mints a new device token given the right recovery token', async () => {
    const service = newService();
    const created = await createTestAccount(service);

    const recovered = await service.recoverAccount(created.recoveryToken);
    expect(recovered.account.playerId).toBe(created.account.playerId);
    expect(recovered.deviceToken).not.toBe(created.deviceToken);
  });

  it('tolerates dashes/casing differences when recovering', async () => {
    const service = newService();
    const created = await createTestAccount(service);
    const mangled = created.recoveryToken.toLowerCase().replace(/-/g, ' ');

    const recovered = await service.recoverAccount(mangled);
    expect(recovered.account.playerId).toBe(created.account.playerId);
  });

  it('rejects a wrong recovery token', async () => {
    const service = newService();
    await createTestAccount(service);
    await expect(service.recoverAccount('GC-0000-0000-0000-0000')).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
  });

  it('invalidates the previous device token once a new device recovers the account', async () => {
    const service = newService();
    const created = await createTestAccount(service);
    await service.recoverAccount(created.recoveryToken);

    await expect(service.getOwnAccount(created.deviceToken)).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
  });
});

describe('PlayerAccountService.regenerateRecoveryToken', () => {
  it('invalidates the old recovery token and returns a new one', async () => {
    const service = newService();
    const created = await createTestAccount(service);

    const { recoveryToken: newToken } = await service.regenerateRecoveryToken(created.deviceToken);
    expect(newToken).not.toBe(created.recoveryToken);

    await expect(service.recoverAccount(created.recoveryToken)).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
    const recovered = await service.recoverAccount(newToken);
    expect(recovered.account.playerId).toBe(created.account.playerId);
  });

  it('rejects regenerating without a valid device token', async () => {
    const service = newService();
    await expect(service.regenerateRecoveryToken('bogus-token')).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
  });
});

describe('PlayerAccountService.isUsernameAvailable', () => {
  it('reports true for an unused, validly formatted username', async () => {
    const service = newService();
    await expect(service.isUsernameAvailable('freshname')).resolves.toBe(true);
  });

  it('reports false for a taken username', async () => {
    const service = newService();
    await createTestAccount(service, { username: 'takenname2' });
    await expect(service.isUsernameAvailable('takenname2')).resolves.toBe(false);
  });

  it('reports false for an invalidly formatted username without throwing', async () => {
    const service = newService();
    await expect(service.isUsernameAvailable('a b')).resolves.toBe(false);
  });
});

describe('PlayerAccountService.getLeaderboard', () => {
  it('ranks accounts by wins desc, then gamesPlayed desc', async () => {
    const { repository, service } = newServiceWithRepo();
    const low = await createTestAccount(service, { username: 'lowscore' });
    const high = await createTestAccount(service, { username: 'highscore' });
    await repository.incrementStats(low.account.playerId, true);
    await repository.incrementStats(high.account.playerId, true);
    await repository.incrementStats(high.account.playerId, true);

    const entries = await service.getLeaderboard();

    expect(entries[0]?.playerId).toBe(high.account.playerId);
    expect(entries[1]?.playerId).toBe(low.account.playerId);
  });

  it('ranks bot accounts alongside real ones with no special-casing', async () => {
    const { repository, service } = newServiceWithRepo();
    const bot = seedBot(repository, { wins: 10 });
    const human = await createTestAccount(service, { username: 'humanplayer' });

    const entries = await service.getLeaderboard();

    expect(entries[0]?.playerId).toBe(bot.playerId);
    expect(entries.some((entry) => entry.playerId === human.account.playerId)).toBe(true);
  });

  it('respects the limit', async () => {
    const { repository, service } = newServiceWithRepo();
    for (let index = 0; index < 5; index += 1) {
      seedBot(repository, { playerId: randomUUID(), wins: index });
    }

    await expect(service.getLeaderboard(3)).resolves.toHaveLength(3);
  });
});

describe('PlayerAccountService.listBotPlayers', () => {
  it('returns only bot accounts, mapped to their public identity shape', async () => {
    const { repository, service } = newServiceWithRepo();
    const bot = seedBot(repository, { displayName: 'BotSeat' });
    await createTestAccount(service, { username: 'nobodyshould' });

    const bots = await service.listBotPlayers(5);

    expect(bots).toHaveLength(1);
    expect(bots[0]).toEqual({
      avatar: 'donkey',
      displayName: 'BotSeat',
      playerId: bot.playerId,
    });
  });

  it('respects the requested count', async () => {
    const { repository, service } = newServiceWithRepo();
    for (let index = 0; index < 5; index += 1) {
      seedBot(repository, { playerId: randomUUID() });
    }

    await expect(service.listBotPlayers(2)).resolves.toHaveLength(2);
  });
});

describe('PlayerAccountService.recordMatchResult', () => {
  it("updates the caller's own stats", async () => {
    const { service } = newServiceWithRepo();
    const created = await createTestAccount(service, { username: 'resultowner' });

    await service.recordMatchResult(created.deviceToken, 'WIN');
    const afterWin = await service.getOwnAccount(created.deviceToken);
    expect(afterWin.gamesPlayed).toBe(1);
    expect(afterWin.wins).toBe(1);
    expect(afterWin.losses).toBe(0);

    await service.recordMatchResult(created.deviceToken, 'LOSS');
    const afterLoss = await service.getOwnAccount(created.deviceToken);
    expect(afterLoss.gamesPlayed).toBe(2);
    expect(afterLoss.wins).toBe(1);
    expect(afterLoss.losses).toBe(1);
  });

  it('also updates any bot accounts included in botResults', async () => {
    const { repository, service } = newServiceWithRepo();
    const created = await createTestAccount(service, { username: 'withbots' });
    const bot = seedBot(repository);

    await service.recordMatchResult(created.deviceToken, 'WIN', [
      { playerId: bot.playerId, result: 'LOSS' },
    ]);

    const updatedBot = await repository.findById(bot.playerId);
    expect(updatedBot?.gamesPlayed).toBe(1);
    expect(updatedBot?.losses).toBe(1);
    expect(updatedBot?.wins).toBe(0);
  });

  it('silently ignores a botResults entry that is not actually a bot account', async () => {
    const { service } = newServiceWithRepo();
    const caller = await createTestAccount(service, { username: 'reporter' });
    const victim = await createTestAccount(service, { username: 'innocentguy' });

    await service.recordMatchResult(caller.deviceToken, 'WIN', [
      { playerId: victim.account.playerId, result: 'LOSS' },
    ]);

    const victimAfter = await service.getOwnAccount(victim.deviceToken);
    expect(victimAfter.gamesPlayed).toBe(0);
  });

  it('rejects an invalid device token', async () => {
    const { service } = newServiceWithRepo();
    await expect(service.recordMatchResult('bogus-token', 'WIN')).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
  });
});

describe('AccountNotFoundError sanity', () => {
  it('is a distinct Error subclass', () => {
    expect(new AccountNotFoundError()).toBeInstanceOf(Error);
  });
});
