export function calculateWinnerReward(pool: number, playerCount: number): number {
  return Math.floor(pool / (playerCount - 1));
}
