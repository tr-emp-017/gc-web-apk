import { useEffect, useState } from 'react';

import { VoiceClient } from './VoiceClient';
import { useRoomStore } from '../stores/roomStore';

export function useVoice(): {
  readonly isMuted: boolean;
  readonly isSpeakerEnabled: boolean;
  readonly peerCount: number;
  readonly toggleMuted: () => void;
  readonly toggleSpeaker: () => void;
  readonly unavailable: boolean;
} {
  const socket = useRoomStore((state) => state.socket);
  const playerId = useRoomStore((state) => state.playerId);
  const [client, setClient] = useState<VoiceClient | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (socket === null || playerId === null) return;

    let voiceClient: VoiceClient;
    try {
      // Constructing or starting the client can throw synchronously when the underlying
      // native voice modules aren't present (e.g. Expo Go) — never let that crash the app.
      voiceClient = new VoiceClient(socket, playerId);
    } catch {
      setUnavailable(true);
      return;
    }

    setClient(voiceClient);
    void voiceClient
      .start()
      .then(() => {
        // Voice starts closed by default; the player opts in via the mic/speaker buttons.
        voiceClient.setMuted(true);
        voiceClient.setSpeakerEnabled(false);
      })
      .catch(() => {
        setClient(null);
        setUnavailable(true);
      });
    return () => {
      try {
        voiceClient.stop();
      } catch {
        // Nothing to clean up if the underlying native modules were never available.
      }
    };
  }, [playerId, socket]);

  useEffect(() => {
    if (client === null) return;
    const interval = setInterval(() => setPeerCount(client.getPeerCount()), 1000);
    return () => clearInterval(interval);
  }, [client]);

  return {
    isMuted,
    isSpeakerEnabled,
    peerCount,
    toggleMuted: () => {
      const nextMuted = !isMuted;
      client?.setMuted(nextMuted);
      setIsMuted(nextMuted);
    },
    toggleSpeaker: () => {
      const nextEnabled = !isSpeakerEnabled;
      client?.setSpeakerEnabled(nextEnabled);
      setIsSpeakerEnabled(nextEnabled);
    },
    unavailable,
  };
}
