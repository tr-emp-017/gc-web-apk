export interface WalletLedger {
  getBalance(playerId: string): number;
  debit(playerId: string, amount: number): void;
  credit(playerId: string, amount: number): void;
}
