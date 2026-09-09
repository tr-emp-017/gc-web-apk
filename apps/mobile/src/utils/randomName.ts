const ADJECTIVES = [
  'Turbo',
  'Sneaky',
  'Golden',
  'Mighty',
  'Silent',
  'Crimson',
  'Rapid',
  'Clever',
  'Fierce',
  'Lucky',
  'Shadow',
  'Royal',
  'Wild',
  'Blazing',
  'Frosty',
  'Jolly',
] as const;

const NOUNS = [
  'Tiger',
  'Falcon',
  'Ninja',
  'Wolf',
  'Cobra',
  'Panther',
  'Eagle',
  'Dragon',
  'Raider',
  'Hunter',
  'Rogue',
  'Champion',
  'Wizard',
  'Knight',
  'Phantom',
  'Ace',
] as const;

export function generateRandomGamerName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(Math.random() * 90) + 10;
  return `${adjective}${noun}${number}`;
}
