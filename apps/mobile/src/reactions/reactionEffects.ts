import type { ReactionId } from '@gadha-chor/shared-types';

// Per-reaction animation tuning, kept separate from the flight/impact components themselves
// so a new reaction only ever needs an entry here (plus a REACTION_SYMBOLS emoji and, once the
// asset exists, a line in REACTION_SOUND_ASSETS below) — never a change to ReactionFlyer.
export type ReactionEffectConfig = {
  // How long the emoji takes to travel from the sender's seat to the target's.
  readonly travelDurationMs: number;
  // How long the impact effect (rendered at the target's seat once the travel lands) stays
  // on screen before the whole reaction is done animating.
  readonly impactDurationMs: number;
  // What the impact effect shows — an emoji burst, distinct from the traveling emoji itself
  // (e.g. a bomb travels as 💣 but bursts into 💥).
  readonly impactEmoji: string;
  // Total rotation (degrees) applied over the course of the travel — a slipper tumbling end
  // over end reads very differently from a rose drifting over with barely a wobble.
  readonly travelSpinDeg: number;
};

export const REACTION_EFFECTS: Record<ReactionId, ReactionEffectConfig> = {
  bomb: { impactDurationMs: 700, impactEmoji: '💥', travelDurationMs: 750, travelSpinDeg: 25 },
  egg: { impactDurationMs: 650, impactEmoji: '💦', travelDurationMs: 600, travelSpinDeg: 30 },
  kiss: { impactDurationMs: 900, impactEmoji: '💕', travelDurationMs: 650, travelSpinDeg: 8 },
  rose: { impactDurationMs: 900, impactEmoji: '✨', travelDurationMs: 700, travelSpinDeg: 10 },
  slipper: { impactDurationMs: 500, impactEmoji: '💫', travelDurationMs: 450, travelSpinDeg: 360 },
  tea: { impactDurationMs: 700, impactEmoji: '♨️', travelDurationMs: 700, travelSpinDeg: 20 },
};

// Drop each reaction's sound file at apps/mobile/assets/reactions/<file>.mp3 and add one line
// below to wire it in (uncommenting a `require(...)` line here needs a
// `// eslint-disable-next-line @typescript-eslint/no-require-imports` above it, same as the
// static asset requires elsewhere in this app). A reaction with no entry here just animates
// silently — nothing breaks while files are still on the way.
export const REACTION_SOUND_ASSETS: Partial<Record<ReactionId, number>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  bomb: require('../../assets/reactions/bomb-explode.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  egg: require('../../assets/reactions/egg-break.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  kiss: require('../../assets/reactions/kiss.mp3'),
  // rose: require('../../assets/reactions/rose.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  slipper: require('../../assets/reactions/slipper-hit.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- static asset require
  tea: require('../../assets/reactions/tea.mp3'),
};
