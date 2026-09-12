import type {
  ActionResponse,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@gadha-chor/shared-types';

import type { Server as HttpServer } from 'node:http';
import { RoomManager } from '../room/RoomManager.js';
import { Server } from 'socket.io';
import { errorMessage } from '../room/roomErrors.js';

type InterServerEvents = Record<string, never>;
type SocketData = { code?: string; playerId?: string };
type GameSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(
  httpServer: HttpServer,
  roomManager = new RoomManager(),
): GameSocketServer {
  const io: GameSocketServer = new Server(httpServer, {
    cors: { origin: true },
  });

  const emitRoomUpdated = (code: string): void => {
    io.to(code).emit('room:updated', roomManager.getRoomSummary(code));
  };

  // Broadcast to every connected socket, not just one room's channel — an open Rooms browser
  // has no particular room to scope this to. The list itself is small (a handful of lightweight
  // RoomListing entries), so a full broadcast on every list-affecting mutation is cheap.
  const emitRoomsListUpdated = (): void => {
    io.emit('rooms:updated', roomManager.listRooms());
  };

  const emitGameState = (code: string): void => {
    for (const player of roomManager.getRoomSummary(code).players) {
      const playerSocketId = roomManager.getPlayer(code, player.id).socketId;
      if (playerSocketId !== undefined) {
        io.to(playerSocketId).emit('game:state', roomManager.getPublicGameState(code, player.id));
      }
    }
  };

  io.on('connection', (socket) => {
    socket.on('room:create', (payload, callback) => {
      try {
        const session = roomManager.createRoom(
          payload.name,
          payload.avatar,
          socket.id,
          payload.entryPoints,
          payload.showCardCounts,
          payload.isPublic,
        );
        socket.data.code = session.code;
        socket.data.playerId = session.playerId;
        void socket.join(session.code);
        callback({
          ok: true,
          room: roomManager.getRoomSummary(session.code),
          playerId: session.playerId,
          walletBalance: session.walletBalance,
        });
        emitRoomsListUpdated();
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('room:join', (payload, callback) => {
      try {
        const session = roomManager.joinRoom(payload.code, payload.name, payload.avatar, socket.id);
        socket.data.code = session.code;
        socket.data.playerId = session.playerId;
        void socket.join(session.code);
        callback({
          ok: true,
          room: roomManager.getRoomSummary(session.code),
          playerId: session.playerId,
          walletBalance: session.walletBalance,
        });
        emitRoomUpdated(session.code);
        emitRoomsListUpdated();
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('room:quickMatch', (payload, callback) => {
      try {
        const session = roomManager.quickMatch(
          payload.name,
          payload.avatar,
          payload.playerCount,
          socket.id,
          payload.entryPoints,
          payload.showCardCounts,
        );
        socket.data.code = session.code;
        socket.data.playerId = session.playerId;
        void socket.join(session.code);
        callback({
          ok: true,
          room: roomManager.getRoomSummary(session.code),
          playerId: session.playerId,
          walletBalance: session.walletBalance,
        });
        if (session.started !== undefined) {
          for (const player of roomManager.getRoomSummary(session.code).players) {
            const playerSocketId = roomManager.getPlayer(session.code, player.id).socketId;
            if (playerSocketId !== undefined) {
              io.to(playerSocketId).emit(
                'game:started',
                roomManager.getPublicGameState(session.code, player.id),
              );
            }
          }
          for (const balance of session.started.balances) {
            const playerSocketId = roomManager.getPlayer(session.code, balance.playerId).socketId;
            if (playerSocketId !== undefined) {
              io.to(playerSocketId).emit('wallet:updated', { balance: balance.balance });
            }
          }
        }
        emitRoomUpdated(session.code);
        emitRoomsListUpdated();
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('room:list', (callback) => {
      callback({ ok: true, rooms: roomManager.listRooms() });
    });

    socket.on('game:reconnect', (payload, callback) => {
      try {
        const room = roomManager.reconnect(payload.code, payload.playerId, socket.id);
        socket.data.code = room.code;
        socket.data.playerId = payload.playerId;
        void socket.join(room.code);
        const state = roomManager.getPublicGameStateIfStarted(room.code, payload.playerId);
        callback({
          ok: true,
          room: roomManager.getRoomSummary(room.code),
          playerId: payload.playerId,
          walletBalance: roomManager.getWalletBalance(payload.playerId),
          state,
        });
        socket.to(room.code).emit('player:reconnected', payload.playerId);
        emitRoomUpdated(room.code);
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('room:leave', (callback) => {
      const session = getSession(socket);
      if (session === undefined) {
        callback({ ok: true });
        return;
      }
      try {
        roomManager.leave(session.code, session.playerId);
        void socket.leave(session.code);
        clearSession(socket);
        callback({ ok: true });
        // Comes first: leave() may have emptied and deleted the room, which would make
        // emitRoomUpdated below throw (room no longer found) — the list update itself is
        // always safe since it just reflects whichever rooms are still there.
        emitRoomsListUpdated();
        try {
          emitRoomUpdated(session.code);
        } catch {
          // Room was deleted because it emptied — nothing left to notify.
        }
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('room:kick', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const { socketId } = roomManager.kickPlayer(
          session.code,
          session.playerId,
          payload.targetPlayerId,
        );
        callback({ ok: true });
        if (socketId !== undefined) {
          const kickedSocket = io.sockets.sockets.get(socketId);
          kickedSocket?.emit('room:kicked');
          void kickedSocket?.leave(session.code);
          if (kickedSocket !== undefined) {
            clearSession(kickedSocket);
          }
        }
        emitRoomUpdated(session.code);
        emitRoomsListUpdated();
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('game:exit', (callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const endedState = roomManager.endGameForExit(session.code, session.playerId);
        void socket.leave(session.code);
        clearSession(socket);
        roomManager.disconnect(session.code, session.playerId, () => {
          // This only fires once the reconnect window actually expires and the player is
          // removed (or the now-empty room deleted) — the moment the Rooms browser's listed
          // headcount for this room, if any, actually changes.
          emitRoomsListUpdated();
          try {
            emitRoomUpdated(session.code);
          } catch {
            // Room no longer exists (its last player's reconnect window expired); nothing to notify.
          }
        });
        callback({ ok: true });
        if (endedState !== undefined) {
          emitGameState(session.code);
          io.to(session.code).emit('game:over', {
            gadhaChorId: session.playerId,
            state: endedState,
          });
        }
        emitRoomUpdated(session.code);
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('game:leave', (callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        roomManager.leaveGame(session.code, session.playerId);
        void socket.leave(session.code);
        clearSession(socket);
        callback({ ok: true });
        emitRoomUpdated(session.code);
        emitGameState(session.code);
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('game:spectate', (callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        roomManager.spectateGame(session.code, session.playerId);
        callback({ ok: true });
        emitRoomUpdated(session.code);
        emitGameState(session.code);
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('room:playAgain', (callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        roomManager.playAgain(session.code, session.playerId);
        callback({ ok: true });
        // No emitGameState here — there's no game any more (room.game is now undefined), and
        // getPublicGameState throws in that case. room:updated alone (status now 'LOBBY') is
        // what tells every client to drop back to the lobby and clear their stale gameState.
        emitRoomUpdated(session.code);
        // The room is joinable/listed again now that it's back in LOBBY.
        emitRoomsListUpdated();
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('voice:join', (callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const players = roomManager.getRoomSummary(session.code).players;
        for (const player of players) {
          if (player.id !== session.playerId && player.connected) {
            const playerSocketId = roomManager.getPlayer(session.code, player.id).socketId;
            if (playerSocketId !== undefined) {
              io.to(playerSocketId).emit('voice:peer-joined', {
                playerId: session.playerId,
                initiator: false,
              });
              socket.emit('voice:peer-joined', { playerId: player.id, initiator: true });
            }
          }
        }
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('voice:leave', () => {
      const session = getSession(socket);
      if (session !== undefined) {
        socket.to(session.code).emit('voice:peer-left', { playerId: session.playerId });
      }
    });

    socket.on('voice:offer', (payload) =>
      relayVoiceSignal(
        socket,
        payload.targetPlayerId,
        'voice:offer',
        { offer: payload.offer },
        roomManager,
        io,
      ),
    );
    socket.on('voice:answer', (payload) =>
      relayVoiceSignal(
        socket,
        payload.targetPlayerId,
        'voice:answer',
        { answer: payload.answer },
        roomManager,
        io,
      ),
    );
    socket.on('voice:ice-candidate', (payload) =>
      relayVoiceSignal(
        socket,
        payload.targetPlayerId,
        'voice:ice-candidate',
        { candidate: payload.candidate },
        roomManager,
        io,
      ),
    );

    socket.on('player:ready', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        roomManager.setReady(session.code, session.playerId, payload.ready);
        callback({ ok: true });
        emitRoomUpdated(session.code);
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('game:start', (callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const result = roomManager.startGame(session.code, session.playerId);
        callback({ ok: true });
        for (const player of roomManager.getRoomSummary(session.code).players) {
          const playerSocketId = roomManager.getPlayer(session.code, player.id).socketId;
          if (playerSocketId !== undefined) {
            io.to(playerSocketId).emit(
              'game:started',
              roomManager.getPublicGameState(session.code, player.id),
            );
          }
        }
        for (const balance of result.balances) {
          const playerSocketId = roomManager.getPlayer(session.code, balance.playerId).socketId;
          if (playerSocketId !== undefined) {
            io.to(playerSocketId).emit('wallet:updated', { balance: balance.balance });
          }
        }
        emitRoomUpdated(session.code);
        // The room drops off the Rooms browser now that it's PLAYING.
        emitRoomsListUpdated();
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('card:play', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const result = roomManager.playCard(session.code, session.playerId, payload.cardId);
        io.to(session.code).emit('card:played', {
          playerId: session.playerId,
          cardId: payload.cardId,
          isInaam: result.isInaam,
        });
        if (
          result.isInaam &&
          result.leaderId !== undefined &&
          result.inaamReceiverId !== undefined
        ) {
          io.to(session.code).emit('inaam:given', {
            playerId: session.playerId,
            cardId: payload.cardId,
            leaderId: result.leaderId,
            receiverId: result.inaamReceiverId,
            cards: result.inaamCards ?? [],
          });
        } else if (result.chaalWinnerId !== undefined) {
          io.to(session.code).emit('chaal:completed', {
            winnerId: result.chaalWinnerId,
            cards: result.completedChaal ?? [],
          });
        }
        for (const finishedPlayerId of result.finishedPlayerIds) {
          io.to(session.code).emit('player:finished', {
            playerId: finishedPlayerId,
            reward: result.rewards[finishedPlayerId] ?? 0,
          });
          const finishedSocketId = roomManager.getPlayer(session.code, finishedPlayerId).socketId;
          if (finishedSocketId !== undefined) {
            io.to(finishedSocketId).emit('wallet:updated', {
              balance: roomManager.getWalletBalance(finishedPlayerId),
            });
          }
        }
        callback({ ok: true });
        for (const player of roomManager.getRoomSummary(session.code).players) {
          const playerSocketId = roomManager.getPlayer(session.code, player.id).socketId;
          if (playerSocketId !== undefined) {
            io.to(playerSocketId).emit(
              'game:state',
              roomManager.getPublicGameState(session.code, player.id),
            );
          }
        }
        io.to(session.code).emit('turn:changed', result.state.currentPlayerId);
        if (result.state.status === 'GAME_OVER' && result.state.gadhaChorId !== undefined) {
          io.to(session.code).emit('game:over', {
            gadhaChorId: result.state.gadhaChorId,
            state: result.state,
          });
        }
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('card:requestTransfer', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const { targetSocketId } = roomManager.requestCardTransfer(
          session.code,
          session.playerId,
          payload.targetPlayerId,
        );
        callback({ ok: true });
        if (targetSocketId !== undefined) {
          const requester = roomManager.getPlayer(session.code, session.playerId);
          io.to(targetSocketId).emit('card:transferRequested', {
            requesterId: session.playerId,
            requesterName: requester.name,
          });
        }
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('card:respondTransfer', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        const result = roomManager.respondCardTransfer(
          session.code,
          session.playerId,
          payload.accept,
        );
        callback({ ok: true });
        io.to(session.code).emit('card:transferResolved', {
          requesterId: result.requesterId,
          targetId: session.playerId,
          accepted: result.accepted,
          cardCount: result.cardCount,
        });
        if (!result.accepted) {
          return;
        }
        for (const finishedPlayerId of result.finishedPlayerIds) {
          io.to(session.code).emit('player:finished', {
            playerId: finishedPlayerId,
            reward: result.rewards[finishedPlayerId] ?? 0,
          });
          const finishedSocketId = roomManager.getPlayer(session.code, finishedPlayerId).socketId;
          if (finishedSocketId !== undefined) {
            io.to(finishedSocketId).emit('wallet:updated', {
              balance: roomManager.getWalletBalance(finishedPlayerId),
            });
          }
        }
        for (const player of roomManager.getRoomSummary(session.code).players) {
          const playerSocketId = roomManager.getPlayer(session.code, player.id).socketId;
          if (playerSocketId !== undefined) {
            io.to(playerSocketId).emit(
              'game:state',
              roomManager.getPublicGameState(session.code, player.id),
            );
          }
        }
        const latestState = roomManager.getPublicGameState(session.code, session.playerId);
        io.to(session.code).emit('turn:changed', latestState.currentPlayerId);
        if (latestState.status === 'GAME_OVER' && latestState.gadhaChorId !== undefined) {
          io.to(session.code).emit('game:over', {
            gadhaChorId: latestState.gadhaChorId,
            state: latestState,
          });
        }
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('player:react', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      try {
        if (payload.targetPlayerId === session.playerId) {
          throw new Error('Choose another player for a reaction.');
        }
        roomManager.getPlayer(session.code, payload.targetPlayerId);
        io.to(session.code).emit('player:reacted', {
          fromPlayerId: session.playerId,
          targetPlayerId: payload.targetPlayerId,
          reaction: payload.reaction,
        });
        callback({ ok: true });
      } catch (error) {
        callback({ ok: false, error: errorMessage(error) });
      }
    });

    socket.on('sound:play', (payload, callback) => {
      const session = requireSession(socket, callback);
      if (session === undefined) {
        return;
      }
      io.to(session.code).emit('sound:played', {
        playerId: session.playerId,
        soundId: payload.soundId,
      });
      callback({ ok: true });
    });

    socket.on('disconnect', () => {
      const session = getSession(socket);
      if (session === undefined) {
        return;
      }
      try {
        const endedState = roomManager.endGameForExit(session.code, session.playerId);
        roomManager.disconnect(session.code, session.playerId, () => {
          // This only fires once the reconnect window actually expires and the player is
          // removed (or the now-empty room deleted) — the moment the Rooms browser's listed
          // headcount for this room, if any, actually changes.
          emitRoomsListUpdated();
          try {
            emitRoomUpdated(session.code);
          } catch {
            // Room no longer exists (its last player's reconnect window expired); nothing to notify.
          }
        });
        if (endedState !== undefined) {
          emitGameState(session.code);
          io.to(session.code).emit('game:over', {
            gadhaChorId: session.playerId,
            state: endedState,
          });
        } else {
          socket.to(session.code).emit('player:disconnected', session.playerId);
        }
        emitRoomUpdated(session.code);
      } catch {
        clearSession(socket);
      }
    });
  });

  return io;
}

function relayVoiceSignal(
  socket: { data: SocketData },
  targetPlayerId: string,
  event: 'voice:offer' | 'voice:answer' | 'voice:ice-candidate',
  payload: { readonly offer?: unknown; readonly answer?: unknown; readonly candidate?: unknown },
  roomManager: RoomManager,
  io: GameSocketServer,
): void {
  const session = getSession(socket);
  if (session === undefined) return;
  try {
    const target = roomManager.getPlayer(session.code, targetPlayerId);
    if (target.socketId === undefined) return;
    io.to(target.socketId).emit(event, { fromPlayerId: session.playerId, ...payload } as never);
  } catch {
    // Ignore stale peers during reconnects.
  }
}

function getSession(socket: { data: SocketData }): { code: string; playerId: string } | undefined {
  const { code, playerId } = socket.data;
  return code !== undefined && playerId !== undefined ? { code, playerId } : undefined;
}

function clearSession(socket: { data: SocketData }): void {
  delete socket.data.code;
  delete socket.data.playerId;
}

function requireSession(
  socket: { data: SocketData },
  callback: (response: ActionResponse) => void,
): { code: string; playerId: string } | undefined {
  const session = getSession(socket);
  if (session === undefined) {
    callback({ ok: false, error: 'Socket is not connected to a room.' });
  }
  return session;
}
