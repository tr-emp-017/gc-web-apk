import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { InMemoryPlayerAccountRepository } from './account/InMemoryPlayerAccountRepository.js';
import { PlayerAccountService } from './account/PlayerAccountService.js';
import { PostgresPlayerAccountRepository } from './account/PostgresPlayerAccountRepository.js';
import { registerAccountRoutes } from './account/accountRoutes.js';
import { createPgPool } from './db/pgPool.js';
import { migrate } from './db/migrate.js';
import { createSocketServer } from './socket/createSocketServer.js';

export async function createApp() {
  // Behind Render's proxy every request otherwise appears to come from the same address,
  // which would make the rate limiter below block everyone instead of individual clients.
  const app = Fastify({ logger: true, trustProxy: true });
  const io = createSocketServer(app.server);

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim());
  await app.register(cors, { origin: allowedOrigins ?? true });
  await app.register(rateLimit, { global: false, max: 100, timeWindow: '1 minute' });

  const databaseUrl = process.env.DATABASE_URL;
  let accountRepository;
  if (databaseUrl !== undefined && databaseUrl.length > 0) {
    const pool = createPgPool(databaseUrl);
    try {
      await migrate(pool);
    } catch (error) {
      // A migration failure must never prevent the rest of the game (rooms, bots, voice) from
      // starting — only the account routes depend on this table existing.
      app.log.error(error, 'Failed to run player account migrations.');
    }
    accountRepository = new PostgresPlayerAccountRepository(pool);
  } else {
    app.log.warn('DATABASE_URL is not set — player accounts are in-memory and will not persist.');
    accountRepository = new InMemoryPlayerAccountRepository();
  }
  const accountService = new PlayerAccountService(accountRepository);
  registerAccountRoutes(app, accountService);

  app.get('/', async () => ({
    service: 'gadha-chor-server',
    status: 'running',
    health: '/health',
  }));
  app.get('/health', async () => ({ status: 'ok', service: 'gadha-chor-server' }));

  return { app, io };
}
