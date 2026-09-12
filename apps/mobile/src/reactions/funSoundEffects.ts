import type { FunSoundId } from '@gadha-chor/shared-types';

// Per-sound tuning for the room-wide soundboard (see FunSoundPlayback + the bottom-left icon
// in game.tsx). Mirrors reactionEffects.ts's shape: a new sound only ever needs an entry here
// (plus a FUN_SOUND_SYMBOLS emoji in shared-types and a line in FUN_SOUND_ASSETS below) —
// never a change to the playback/flash components themselves.
export type FunSoundEffectConfig = {
  // How long the player's profile keeps flashing, at minimum — extended automatically to
  // match the sound's actual length once it's known (see FunSoundPlayback).
  readonly flashDurationMs: number;
};

export const FUN_SOUND_EFFECTS: Record<FunSoundId, FunSoundEffectConfig> = {
  'aayein-meme': { flashDurationMs: 1500 },
  'aisa-mat-karo': { flashDurationMs: 2200 },
  'aree-bas-kar-bhai': { flashDurationMs: 2200 },
  'cartoon-scream': { flashDurationMs: 1500 },
  'chala-ja-bsdk': { flashDurationMs: 2200 },
  'converted-clip': { flashDurationMs: 2200 },
  'donkey-braying': { flashDurationMs: 2200 },
  'donkey-classic': { flashDurationMs: 1500 },
  'donkey-deep': { flashDurationMs: 1500 },
  'donkey-small': { flashDurationMs: 1500 },
  fart: { flashDurationMs: 1500 },
  'funny-reaction': { flashDurationMs: 1500 },
  gopgopgop: { flashDurationMs: 1500 },
  huh: { flashDurationMs: 1500 },
  'iss-sajjan-ko-kya-takleef-hai-bhai': { flashDurationMs: 2200 },
  'khopdi-tor-salay-ka': { flashDurationMs: 2200 },
  'ki-kore': { flashDurationMs: 2200 },
  'koun-hai-re': { flashDurationMs: 1500 },
  'lekin-ye-sala': { flashDurationMs: 2200 },
  'lund-pakad-ke-tarazu-ki-tarah-cid': { flashDurationMs: 2200 },
  'maa-tari-oo-bhai': { flashDurationMs: 2200 },
  'men-laughing': { flashDurationMs: 1500 },
  'monkey-classic': { flashDurationMs: 1500 },
  'monkey-noise': { flashDurationMs: 1500 },
  'mujhe-apne-ghar-jana-hai': { flashDurationMs: 2200 },
  'tum-dum-tedau': { flashDurationMs: 1500 },
  wooooaah: { flashDurationMs: 1500 },
  'ye-ladki-tum-bohut-bolti-ho-chapad-chapad': { flashDurationMs: 2200 },
  'yeah-boy': { flashDurationMs: 1500 },
  'anime-ahh': { flashDurationMs: 1500 },
  'is-ka-karan-narendar-modi': { flashDurationMs: 2200 },
  'depression-indian': { flashDurationMs: 2200 },
  'bade-harami-ho-beta': { flashDurationMs: 2200 },
  'mka-ladle-meow-gop': { flashDurationMs: 2200 },
  'ek-gand-pe-repta-mara-n-sarak-pe-hagta-firega': { flashDurationMs: 2200 },
  'wow-kya-ladka-hai-very-handsome-boy': { flashDurationMs: 2200 },
  'cid-le-mdc': { flashDurationMs: 2200 },
  khatam: { flashDurationMs: 2200 },
  'ek-din-mar-jayega': { flashDurationMs: 2200 },
  'ruko-jara': { flashDurationMs: 2200 },
};

// Every sound below already has its file at apps/mobile/assets/sounds/<id>.mp3. Drop a new
// one at that same path and add a line here (with the same eslint-disable comment) to wire it
// in — a sound with no entry here still flashes the player's profile, just silently.
export const FUN_SOUND_ASSETS: Partial<Record<FunSoundId, number>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'aayein-meme': require('../../assets/sounds/aayein-meme.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'aisa-mat-karo': require('../../assets/sounds/aisa-mat-karo.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'aree-bas-kar-bhai': require('../../assets/sounds/aree-bas-kar-bhai.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'cartoon-scream': require('../../assets/sounds/cartoon-scream.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'chala-ja-bsdk': require('../../assets/sounds/chala-ja-bsdk.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'converted-clip': require('../../assets/sounds/converted-clip.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'donkey-braying': require('../../assets/sounds/donkey-braying.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'donkey-classic': require('../../assets/sounds/donkey-classic.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'donkey-deep': require('../../assets/sounds/donkey-deep.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'donkey-small': require('../../assets/sounds/donkey-small.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  fart: require('../../assets/sounds/fart.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'funny-reaction': require('../../assets/sounds/funny-reaction.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  gopgopgop: require('../../assets/sounds/gopgopgop.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  huh: require('../../assets/sounds/huh.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'iss-sajjan-ko-kya-takleef-hai-bhai': require('../../assets/sounds/iss-sajjan-ko-kya-takleef-hai-bhai.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'khopdi-tor-salay-ka': require('../../assets/sounds/khopdi-tor-salay-ka.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'ki-kore': require('../../assets/sounds/ki-kore.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'koun-hai-re': require('../../assets/sounds/koun-hai-re.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'lekin-ye-sala': require('../../assets/sounds/lekin-ye-sala.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'lund-pakad-ke-tarazu-ki-tarah-cid': require('../../assets/sounds/lund-pakad-ke-tarazu-ki-tarah-cid.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'maa-tari-oo-bhai': require('../../assets/sounds/maa-tari-oo-bhai.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'men-laughing': require('../../assets/sounds/men-laughing.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'monkey-classic': require('../../assets/sounds/monkey-classic.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'monkey-noise': require('../../assets/sounds/monkey-noise.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'mujhe-apne-ghar-jana-hai': require('../../assets/sounds/mujhe-apne-ghar-jana-hai.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'tum-dum-tedau': require('../../assets/sounds/tum-dum-tedau.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  wooooaah: require('../../assets/sounds/wooooaah.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'ye-ladki-tum-bohut-bolti-ho-chapad-chapad': require('../../assets/sounds/ye-ladki-tum-bohut-bolti-ho-chapad-chapad.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'yeah-boy': require('../../assets/sounds/yeah-boy.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'anime-ahh': require('../../assets/sounds/anime-ahh.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'is-ka-karan-narendar-modi': require('../../assets/sounds/is-ka-karan-narendar-modi.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'depression-indian': require('../../assets/sounds/depression-indian.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'bade-harami-ho-beta': require('../../assets/sounds/bade-harami-ho-beta.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'mka-ladle-meow-gop': require('../../assets/sounds/mka-ladle-meow-gop.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'ek-gand-pe-repta-mara-n-sarak-pe-hagta-firega': require('../../assets/sounds/ek-gand-pe-repta-mara-n-sarak-pe-hagta-firega.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'wow-kya-ladka-hai-very-handsome-boy': require('../../assets/sounds/wow-kya-ladka-hai-very-handsome-boy.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'cid-le-mdc': require('../../assets/sounds/cid-le-mdc.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  khatam: require('../../assets/sounds/khatam.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'ek-din-mar-jayega': require('../../assets/sounds/ek-din-mar-jayega.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  'ruko-jara': require('../../assets/sounds/ruko-jara.mp3'),
};
