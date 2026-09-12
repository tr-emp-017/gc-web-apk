import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AvatarId } from '@gadha-chor/shared-types';
import {
  AccountNotFoundError,
  InvalidCredentialError,
  UsernameTakenError,
  ValidationError,
} from './accountErrors.js';
import type { PlayerAccountService, UpdateAccountInput } from './PlayerAccountService.js';

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string.`);
  }
  return value;
}

function extractBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(.+)$/i.exec(header) : null;
  const token = match?.[1];
  if (token === undefined || token.length === 0) {
    throw new InvalidCredentialError('Missing credential.');
  }
  return token;
}

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ValidationError) {
    return reply.code(400).send({ error: error.message });
  }
  if (error instanceof UsernameTakenError) {
    return reply.code(409).send({ error: error.message });
  }
  if (error instanceof InvalidCredentialError) {
    return reply.code(401).send({ error: error.message });
  }
  if (error instanceof AccountNotFoundError) {
    return reply.code(404).send({ error: error.message });
  }
  request.log.error(error);
  return reply.code(500).send({ error: 'Unexpected server error.' });
}

// A strict per-route rate limit (separate from the generous global default registered on the
// Fastify instance) for the handful of endpoints worth protecting specifically: account
// creation and recovery (both mint credentials) and the username-availability check (a
// scraping/enumeration oracle otherwise).
const STRICT_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

export function registerAccountRoutes(app: FastifyInstance, service: PlayerAccountService): void {
  app.post(
    '/api/accounts',
    { config: { rateLimit: STRICT_RATE_LIMIT } },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown> | undefined;
        const response = await service.createAccount({
          username: requireString(body?.username, 'username'),
          displayName: requireString(body?.displayName, 'displayName'),
          avatar: requireString(body?.avatar, 'avatar') as AvatarId,
          clientRequestId: requireString(body?.clientRequestId, 'clientRequestId'),
        });
        return await reply.code(201).send(response);
      } catch (error) {
        return sendError(request, reply, error);
      }
    },
  );

  app.get('/api/accounts/me', async (request, reply) => {
    try {
      const deviceToken = extractBearerToken(request);
      const account = await service.getOwnAccount(deviceToken);
      return await reply.send({ account });
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.patch('/api/accounts/me', async (request, reply) => {
    try {
      const deviceToken = extractBearerToken(request);
      const body = request.body as Record<string, unknown> | undefined;
      const username = optionalString(body?.username, 'username');
      const displayName = optionalString(body?.displayName, 'displayName');
      const avatar = optionalString(body?.avatar, 'avatar') as AvatarId | undefined;
      const patch: UpdateAccountInput = {
        ...(username !== undefined ? { username } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      };
      const account = await service.updateProfile(deviceToken, patch);
      return await reply.send({ account });
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post(
    '/api/accounts/recover',
    { config: { rateLimit: STRICT_RATE_LIMIT } },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown> | undefined;
        const response = await service.recoverAccount(
          requireString(body?.recoveryToken, 'recoveryToken'),
        );
        return await reply.send(response);
      } catch (error) {
        return sendError(request, reply, error);
      }
    },
  );

  app.post('/api/accounts/recovery-token/regenerate', async (request, reply) => {
    try {
      const deviceToken = extractBearerToken(request);
      const response = await service.regenerateRecoveryToken(deviceToken);
      return await reply.send(response);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get(
    '/api/accounts/username-available',
    { config: { rateLimit: STRICT_RATE_LIMIT } },
    async (request, reply) => {
      try {
        const query = request.query as Record<string, unknown> | undefined;
        const username = requireString(query?.u, 'u');
        const available = await service.isUsernameAvailable(username);
        return await reply.send({ available });
      } catch (error) {
        return sendError(request, reply, error);
      }
    },
  );
}
