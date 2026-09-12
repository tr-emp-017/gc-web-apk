// One-off seed script — inserts a fixed pool of bot opponent accounts (is_bot: true) for
// "Play with Bots" to seat, so they behave exactly like real players everywhere (leaderboard,
// their own evolving win/loss record) instead of a fake overlay. Idempotent: re-running it is a
// no-op for bots that already exist, thanks to the pinned player_id + ON CONFLICT DO NOTHING.
//
// Usage: node --env-file=.env --experimental-strip-types scripts/seedBotAccounts.ts
//   (or: npx tsx --env-file=.env scripts/seedBotAccounts.ts)
// Requires DATABASE_URL to point at the target Postgres database.

import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

type BotSeed = {
  readonly playerId: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatar: string;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
};

// Pinned player_id per bot so re-running this script never creates duplicates.
const BOT_SEEDS: readonly BotSeed[] = [
  {
    avatar: 'beard-glasses',
    displayName: 'RajuKing99',
    gamesPlayed: 58,
    losses: 17,
    playerId: '95dc374f-c82f-4e08-a2d4-2827a9e8f441',
    username: 'rajuking99',
    wins: 41,
  },
  {
    avatar: 'cool-hoodie',
    displayName: 'DesiDon',
    gamesPlayed: 52,
    losses: 16,
    playerId: 'dd9dd667-4c7a-4ea4-8f4c-c766d8d2adb6',
    username: 'desidon',
    wins: 36,
  },
  {
    avatar: 'peace-sign',
    displayName: 'SherniRani',
    gamesPlayed: 47,
    losses: 14,
    playerId: 'b75ecae3-276b-44d7-ab8b-bba95ac851d0',
    username: 'shernirani',
    wins: 33,
  },
  {
    avatar: 'wink-tongue',
    displayName: 'TezRani',
    gamesPlayed: 45,
    losses: 16,
    playerId: '92f380b4-1eba-4d6e-b691-a1e6c11bc062',
    username: 'tezrani',
    wins: 29,
  },
  {
    avatar: 'game-on-cap',
    displayName: 'BablooBhai',
    gamesPlayed: 40,
    losses: 14,
    playerId: 'b2f2400c-7b2b-4d53-b305-181129f3fa12',
    username: 'babloobhai',
    wins: 26,
  },
  {
    avatar: 'donkey',
    displayName: 'GoldenGadha',
    gamesPlayed: 38,
    losses: 14,
    playerId: '88f461a3-2baa-4169-a1cc-9127823b1a65',
    username: 'goldengadha',
    wins: 24,
  },
  {
    avatar: 'headphones',
    displayName: 'JugaduJeet',
    gamesPlayed: 35,
    losses: 14,
    playerId: 'e24c00d3-b0db-47ba-9623-a327fe19f216',
    username: 'jugadujeet',
    wins: 21,
  },
  {
    avatar: 'big-laugh',
    displayName: 'MunnaBhai47',
    gamesPlayed: 33,
    losses: 14,
    playerId: 'b067c9c9-89a6-4f0a-88f1-ebb08e684f6f',
    username: 'munnabhai47',
    wins: 19,
  },
  {
    avatar: 'dreamy-hands',
    displayName: 'PinkyStar',
    gamesPlayed: 30,
    losses: 13,
    playerId: '4b935aad-ebed-40fc-ae0d-fc3b4f33696e',
    username: 'pinkystar',
    wins: 17,
  },
  {
    avatar: 'thinking-glasses',
    displayName: 'LuckyChacha',
    gamesPlayed: 28,
    losses: 13,
    playerId: '6a801a8a-f27a-44e9-ba88-620422fe3365',
    username: 'luckychacha',
    wins: 15,
  },
  {
    avatar: 'beard-glasses',
    displayName: 'ChilledChaii',
    gamesPlayed: 25,
    losses: 12,
    playerId: '1c458480-303c-45a2-af7d-7a5e4e1fd2f9',
    username: 'chilledchaii',
    wins: 13,
  },
  {
    avatar: 'cool-hoodie',
    displayName: 'BindaasBabu',
    gamesPlayed: 22,
    losses: 11,
    playerId: 'a3c1dda8-bb89-452c-b00e-a68a1dc95577',
    username: 'bindaasbabu',
    wins: 11,
  },
  {
    avatar: 'peace-sign',
    displayName: 'MeethaMirchi',
    gamesPlayed: 20,
    losses: 11,
    playerId: 'c4376366-9b74-43ac-9885-929033bb6ee5',
    username: 'meethamirchi',
    wins: 9,
  },
  {
    avatar: 'wink-tongue',
    displayName: 'RapidRaja',
    gamesPlayed: 18,
    losses: 11,
    playerId: '2571476b-fd9c-4a1a-8170-83a41fd971c2',
    username: 'rapidraja',
    wins: 7,
  },
  {
    avatar: 'donkey',
    displayName: 'ChotaChor',
    gamesPlayed: 15,
    losses: 10,
    playerId: '56924117-fbb5-480a-92a1-4d4191248d5b',
    username: 'chotachor',
    wins: 5,
  },
];

function unusableHash(): string {
  // 256 random bits, hex-encoded — satisfies the NOT NULL + UNIQUE columns without ever being
  // a real SHA-256 of an actual token, since no one is ever meant to hold these bots' tokens.
  return randomBytes(32).toString('hex');
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is not set.');
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: true } });
  try {
    for (const bot of BOT_SEEDS) {
      const result = await pool.query(
        `INSERT INTO players
           (player_id, username, display_name, avatar, games_played, wins, losses,
            device_token_hash, recovery_token_hash, is_bot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         ON CONFLICT (player_id) DO NOTHING`,
        [
          bot.playerId,
          bot.username,
          bot.displayName,
          bot.avatar,
          bot.gamesPlayed,
          bot.wins,
          bot.losses,
          unusableHash(),
          unusableHash(),
        ],
      );
      console.info(
        result.rowCount === 1
          ? `Inserted ${bot.displayName}`
          : `Skipped ${bot.displayName} (already exists)`,
      );
    }
  } finally {
    await pool.end();
  }
}

await main();
