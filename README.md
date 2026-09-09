# Gadha Chor

Production-oriented Android-first multiplayer card game monorepo.

## Phase 1 structure

- `apps/mobile`: Expo Router React Native client. It renders server state and owns client UX only.
- `apps/server`: Node.js authoritative realtime server. It will own rooms, sessions, Socket.IO, persistence, and calls to the game engine.
- `packages/game-engine`: Pure TypeScript rules and state transitions. No React Native, network, database, or Socket.IO dependencies.
- `packages/shared-types`: Contracts shared by the mobile app and server, including typed socket payloads.
- `packages/shared-utils`: Small dependency-light utilities that are not game rules.

Phase 2 contains the pure game engine and Vitest coverage. Phase 3 now includes the authoritative in-memory room/session service, typed Socket.IO contracts, Fastify health endpoint, ready-gated game start, reconnect retention, and per-player hidden-card projections. Redis and PostgreSQL remain planned production adapters behind the room/session boundary.

## Prerequisites

- Node.js 18.18 or newer
- pnpm 9.15.5 (Corepack can provide the pinned version)

## Commands

```sh
corepack enable
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
```

## Server development

```sh
pnpm --filter @gadha-chor/server dev
```

The server exposes `GET /health` and Socket.IO room/game events. The current session store is in-memory for local development; do not use it for multi-instance deployment until the Redis adapter is added.
