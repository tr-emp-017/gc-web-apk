import type { MatchResult } from '@gadha-chor/shared-types';
import { recordMatchResult } from '../api/accountApi';
import { BOT_MATCH_HUMAN_ID } from './botMatch';

// Called once, from BotMatch's onGameOver handler. Best-effort: a bot match already ran
// entirely on-device with zero server dependency, so a failed report here must never surface
// as an error to the player — it just means this particular match's result doesn't make it
// into anyone's stats.
export async function reportBotMatchResult(
  gadhaChorId: string | undefined,
  deviceToken: string | null,
  serverBotIds: ReadonlySet<string>,
): Promise<void> {
  // undefined means the match ended some other way than a normal Gadha Chor determination
  // (e.g. aborted) — nothing meaningful to report.
  if (gadhaChorId === undefined || deviceToken === null) {
    return;
  }
  const ownResult: MatchResult = gadhaChorId === BOT_MATCH_HUMAN_ID ? 'LOSS' : 'WIN';
  const botResults = [...serverBotIds].map((playerId) => ({
    playerId,
    result: (playerId === gadhaChorId ? 'LOSS' : 'WIN') as MatchResult,
  }));
  try {
    await recordMatchResult(deviceToken, ownResult, botResults);
  } catch {
    // Ignore — see the note above.
  }
}
