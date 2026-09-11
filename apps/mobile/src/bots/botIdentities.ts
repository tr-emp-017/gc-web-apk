import type { BotIdentity } from './types';

// A fixed pool of bot personas to fill empty seats — up to 5, since the largest table
// (6 players) needs at most 5 bots alongside the human. Shuffled and sliced per match so the
// same match doesn't always seat the same bots in the same order.
const BOT_POOL: readonly BotIdentity[] = [
  { avatar: 'wink-tongue', id: 'bot-rani', name: 'Rani' },
  { avatar: 'donkey', id: 'bot-bunty', name: 'Bunty' },
  { avatar: 'cool-hoodie', id: 'bot-sanya', name: 'Sanya' },
  { avatar: 'peace-sign', id: 'bot-chintu', name: 'Chintu' },
  { avatar: 'headphones', id: 'bot-meera', name: 'Meera' },
];

export function pickBotIdentities(count: number): BotIdentity[] {
  const shuffled = [...BOT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
