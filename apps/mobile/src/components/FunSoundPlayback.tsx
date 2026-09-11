import { useEffect } from 'react';
import type { FunSoundId } from '@gadha-chor/shared-types';
import { FUN_SOUND_ASSETS, FUN_SOUND_EFFECTS } from '../reactions/funSoundEffects';
import { useOptionalSound } from '../hooks/useOptionalSound';

type FunSoundPlaybackProps = {
  readonly soundId: FunSoundId;
  // Called once the sound has finished (or, if it has no asset yet, after the configured
  // flashDurationMs) — game.tsx removes the flash at that point.
  readonly onComplete: () => void;
};

// Invisible on purpose: plays one soundboard sound the instant it mounts and reports back
// when to stop flashing the player's profile. Kept separate from AvatarFlash (which only
// renders the visual, at the player's actual seat) since one soundboard play can only ever
// happen once, while the flash needs to render per-seat wherever that player's avatar is.
export function FunSoundPlayback({ soundId, onComplete }: FunSoundPlaybackProps): null {
  const play = useOptionalSound(FUN_SOUND_ASSETS[soundId]);

  useEffect(() => {
    const soundDurationMs = play();
    const timer = setTimeout(onComplete, Math.max(FUN_SOUND_EFFECTS[soundId].flashDurationMs, soundDurationMs));
    return () => clearTimeout(timer);
    // Runs once per mount: one FunSoundPlayback exists for exactly one soundboard play, then
    // the parent unmounts it once onComplete fires.
  }, []);

  return null;
}
