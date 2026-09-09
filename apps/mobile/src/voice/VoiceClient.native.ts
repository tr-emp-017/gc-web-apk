import type { ClientToServerEvents, ServerToClientEvents } from '@gadha-chor/shared-types';
import InCallManager from 'react-native-incall-manager';
import type { Socket } from 'socket.io-client';

type MediaStream = import('react-native-webrtc').MediaStream;
type RTCIceCandidate = import('react-native-webrtc').RTCIceCandidate;
type RTCPeerConnection = import('react-native-webrtc').RTCPeerConnection;

// react-native-webrtc's native module isn't present in Expo Go, and it throws as soon as
// it's imported. Loading it lazily (only once voice actually starts) keeps this module
// importable so screens that reference VoiceClient don't crash just from being opened.
function loadWebRTC(): typeof import('react-native-webrtc') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must load lazily, see comment above
  return require('react-native-webrtc');
}

type VoiceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type SignalDescription = { readonly type: string; readonly sdp?: string | undefined };
type SignalCandidate = {
  readonly candidate?: string | undefined;
  readonly sdpMid?: string | null;
  readonly sdpMLineIndex?: number | null;
};

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export class VoiceClient {
  private localStream: MediaStream | null = null;
  private readonly peers = new Map<string, RTCPeerConnection>();
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
    const { mediaDevices } = loadWebRTC();
    this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
    InCallManager?.start({ media: 'audio' });
    InCallManager?.setForceSpeakerphoneOn(true);
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
    InCallManager?.stop();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.localStream?.getAudioTracks() ?? []) track.enabled = !muted;
  }

  setSpeakerEnabled(enabled: boolean): void {
    this.speakerEnabled = enabled;
    InCallManager?.setForceSpeakerphoneOn(enabled);
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
    const { RTCPeerConnection: RTCPeerConnectionCtor } = loadWebRTC();
    const peer = new RTCPeerConnectionCtor(rtcConfig);
    for (const track of this.localStream?.getTracks() ?? [])
      peer.addTrack(track, this.localStream as MediaStream);
    peer.onicecandidate = (event: { readonly candidate: RTCIceCandidate | null }) => {
      if (event.candidate !== null) {
        const candidate = {
          candidate: event.candidate.candidate ?? undefined,
          ...(event.candidate.sdpMid !== undefined ? { sdpMid: event.candidate.sdpMid } : {}),
          ...(event.candidate.sdpMLineIndex !== undefined
            ? { sdpMLineIndex: event.candidate.sdpMLineIndex }
            : {}),
        };
        this.socket.emit('voice:ice-candidate', {
          targetPlayerId: peerId,
          candidate,
        });
      }
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
    const { RTCSessionDescription } = loadWebRTC();
    await peer.setRemoteDescription(
      new RTCSessionDescription({ type: offer.type as 'offer', sdp: offer.sdp }),
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
    const { RTCSessionDescription } = loadWebRTC();
    await peer.setRemoteDescription(
      new RTCSessionDescription({ type: answer.type as 'answer', sdp: answer.sdp }),
    );
  }

  private async handleIceCandidate(peerId: string, candidate: SignalCandidate): Promise<void> {
    const peer = this.createPeer(peerId);
    if (candidate.candidate === undefined) return;
    const { RTCIceCandidate: RTCIceCandidateCtor } = loadWebRTC();
    await peer.addIceCandidate(
      new RTCIceCandidateCtor({
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
  }
}
