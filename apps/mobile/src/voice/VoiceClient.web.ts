import type { ClientToServerEvents, ServerToClientEvents } from '@gadha-chor/shared-types';
import type { Socket } from 'socket.io-client';

type VoiceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type SignalDescription = { readonly type: string; readonly sdp?: string | undefined };
type SignalCandidate = {
  readonly candidate?: string | undefined;
  readonly sdpMid?: string | null;
  readonly sdpMLineIndex?: number | null;
};

// A STUN-only config only works when both peers can reach each other directly, which fails
// across many real-world networks (mobile data, strict NATs). These free TURN relays (Open
// Relay Project) act as a fallback so voice still connects in those cases.
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export class VoiceClient {
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private readonly remoteAudioEls = new Map<string, HTMLAudioElement>();
  private muted = false;
  private speakerEnabled = true;
  private started = false;

  constructor(
    private readonly socket: VoiceSocket,
    private readonly playerId: string,
  ) {
    socket.on('voice:peer-joined', ({ playerId, initiator }) => {
      void this.handlePeerJoined(playerId, initiator);
    });
    socket.on('voice:peer-left', ({ playerId }) => this.removePeer(playerId));
    socket.on('voice:offer', ({ fromPlayerId, offer }) => {
      void this.handleOffer(fromPlayerId, offer);
    });
    socket.on('voice:answer', ({ fromPlayerId, answer }) => {
      void this.handleAnswer(fromPlayerId, answer);
    });
    socket.on('voice:ice-candidate', ({ fromPlayerId, candidate }) => {
      void this.handleIceCandidate(fromPlayerId, candidate);
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.started = true;
    this.socket.emit('voice:join', (response) => {
      if (!response.ok) {
        throw new Error(response.error);
      }
    });
  }

  stop(): void {
    this.socket.emit('voice:leave');
    for (const playerId of this.peers.keys()) this.removePeer(playerId);
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    this.started = false;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.localStream?.getAudioTracks() ?? []) track.enabled = !muted;
  }

  setSpeakerEnabled(enabled: boolean): void {
    this.speakerEnabled = enabled;
    for (const audio of this.remoteAudioEls.values()) audio.muted = !enabled;
  }

  isMuted(): boolean {
    return this.muted;
  }
  isSpeakerEnabled(): boolean {
    return this.speakerEnabled;
  }
  getPeerCount(): number {
    return this.peers.size;
  }
  getLocalPlayerId(): string {
    return this.playerId;
  }

  private createPeer(peerId: string): RTCPeerConnection {
    const existingPeer = this.peers.get(peerId);
    if (existingPeer !== undefined) return existingPeer;
    const peer = new RTCPeerConnection(rtcConfig);
    for (const track of this.localStream?.getTracks() ?? [])
      peer.addTrack(track, this.localStream as MediaStream);
    peer.onicecandidate = (event) => {
      if (event.candidate !== null) {
        this.socket.emit('voice:ice-candidate', {
          targetPlayerId: peerId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream === undefined) return;
      const audio = new Audio();
      audio.autoplay = true;
      audio.muted = !this.speakerEnabled;
      audio.srcObject = remoteStream;
      this.remoteAudioEls.set(peerId, audio);
    };
    this.peers.set(peerId, peer);
    return peer;
  }

  private async handlePeerJoined(peerId: string, initiator: boolean): Promise<void> {
    const peer = this.createPeer(peerId);
    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.socket.emit('voice:offer', {
        targetPlayerId: peerId,
        offer: { type: offer.type, sdp: offer.sdp ?? undefined },
      });
    }
  }

  private async handleOffer(peerId: string, offer: SignalDescription): Promise<void> {
    const peer = this.createPeer(peerId);
    if (offer.sdp === undefined) return;
    await peer.setRemoteDescription(
      new RTCSessionDescription({ type: offer.type as RTCSdpType, sdp: offer.sdp }),
    );
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    this.socket.emit('voice:answer', {
      targetPlayerId: peerId,
      answer: { type: answer.type, sdp: answer.sdp ?? undefined },
    });
  }

  private async handleAnswer(peerId: string, answer: SignalDescription): Promise<void> {
    const peer = this.peers.get(peerId);
    if (peer === undefined) return;
    if (answer.sdp === undefined) return;
    await peer.setRemoteDescription(
      new RTCSessionDescription({ type: answer.type as RTCSdpType, sdp: answer.sdp }),
    );
  }

  private async handleIceCandidate(peerId: string, candidate: SignalCandidate): Promise<void> {
    const peer = this.createPeer(peerId);
    if (candidate.candidate === undefined) return;
    await peer.addIceCandidate(
      new RTCIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      }),
    );
  }

  private removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    peer?.close();
    this.peers.delete(peerId);
    const audio = this.remoteAudioEls.get(peerId);
    if (audio !== undefined) {
      audio.srcObject = null;
      this.remoteAudioEls.delete(peerId);
    }
  }
}
