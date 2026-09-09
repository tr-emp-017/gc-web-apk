import type { ClientToServerEvents, ServerToClientEvents } from '@gadha-chor/shared-types';

import type { Socket } from 'socket.io-client';

type VoiceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class VoiceClient {
  private muted = false;
  private speakerEnabled = true;

  constructor(
    private readonly socket: VoiceSocket,
    private readonly playerId: string,
  ) {}

  async start(): Promise<void> {
    this.socket.emit('voice:join', () => undefined);
  }

  stop(): void {
    this.socket.emit('voice:leave');
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setSpeakerEnabled(enabled: boolean): void {
    this.speakerEnabled = enabled;
  }

  isMuted(): boolean {
    return this.muted;
  }
  isSpeakerEnabled(): boolean {
    return this.speakerEnabled;
  }
  getPeerCount(): number {
    return 0;
  }
  getLocalPlayerId(): string {
    return this.playerId;
  }
}
