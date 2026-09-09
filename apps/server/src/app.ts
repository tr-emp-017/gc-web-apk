import Fastify from 'fastify';
import { createSocketServer } from './socket/createSocketServer.js';

export function createApp() {
  const app = Fastify({ logger: true });
  const io = createSocketServer(app.server);

  app.get('/', async () => ({
    service: 'gadha-chor-server',
    status: 'running',
    health: '/health',
  }));
  app.get('/health', async () => ({ status: 'ok', service: 'gadha-chor-server' }));

  return { app, io };
}
