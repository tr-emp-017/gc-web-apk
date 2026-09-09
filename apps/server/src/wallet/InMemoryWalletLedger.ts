import type { WalletLedger } from './WalletLedger.js';

const DEFAULT_STARTING_BALANCE = 1000;

export class InMemoryWalletLedger implements WalletLedger {
  private readonly balances = new Map<string, number>();

  constructor(private readonly startingBalance = DEFAULT_STARTING_BALANCE) {}

  getBalance(playerId: string): number {
    const existing = this.balances.get(playerId);
    if (existing !== undefined) {
      return existing;
    }
    this.balances.set(playerId, this.startingBalance);
    return this.startingBalance;
  }

  debit(playerId: string, amount: number): void {
    const balance = this.getBalance(playerId);
    if (balance < amount) {
      throw new Error('Insufficient balance.');
    }
    this.balances.set(playerId, balance - amount);
  }

  credit(playerId: string, amount: number): void {
    const balance = this.getBalance(playerId);
    this.balances.set(playerId, balance + amount);
  }
}
