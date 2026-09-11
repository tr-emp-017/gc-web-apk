import { useEffect, useRef, useState } from 'react';
import type { FunSoundId } from '@gadha-chor/shared-types';
import { FUN_SOUND_ASSETS, FUN_SOUND_EFFECTS } from '../reactions/funSoundEffects';
import { useOptionalSound } from '../hooks/useOptionalSound';

type FunSoundPlaybackProps = {
  readonly soundId: FunSoundId;
  // Called once the sound has actually finished playing AND the configured flashDurationMs
  // minimum has elapsed (whichever is longer) — game.tsx removes the flash, and this
  // component unmounts (releasing the player), only at that point. Never before the sound has
  // genuinely finished — see useOptionalSound for why that used to cut clips short on web.
  readonly onComplete: () => void;
};

// Invisible on purpose: plays one soundboard sound the instant it mounts and reports back
// when to stop flashing the player's profile. Kept separate from AvatarFlash (which only
// renders the visual, at the player's actual seat) since one soundboard play can only ever
// happen once, while the flash needs to render per-seat wherever that player's avatar is.
export function FunSoundPlayback({ soundId, onComplete }: FunSoundPlaybackProps): null {
  const play = useOptionalSound(FUN_SOUND_ASSETS[soundId]);
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const [soundFinished, setSoundFinished] = useState(FUN_SOUND_ASSETS[soundId] === undefined);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setMinDurationElapsed(true),
      FUN_SOUND_EFFECTS[soundId].flashDurationMs,
    );
    play(() => setSoundFinished(true));
    return () => clearTimeout(timer);
    // Runs once per mount: one FunSoundPlayback exists for exactly one soundboard play, then
    // the parent unmounts it once onComplete fires.
  }, []);

  useEffect(() => {
    if (minDurationElapsed && soundFinished && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  }, [minDurationElapsed, soundFinished, onComplete]);

  return null;
}
