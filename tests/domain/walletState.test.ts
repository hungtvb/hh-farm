import { describe, expect, it } from 'vitest';
import {
  createWallet,
  creditWallet,
  debitWallet,
} from '../../src/domain/economy/walletState.js';

describe('wallet state', () => {
  it('creates a non-negative integer balance', () => {
    expect(createWallet(250)).toEqual({ coins: 250 });
    expect(() => createWallet(-1)).toThrow(
      'Wallet coins must be a non-negative safe integer.',
    );
    expect(() => createWallet(1.5)).toThrow(
      'Wallet coins must be a non-negative safe integer.',
    );
  });

  it('debits the exact remaining balance to zero', () => {
    const wallet = createWallet(65);
    const result = debitWallet(wallet, 65);

    expect(result).toEqual({ ok: true, state: { coins: 0 } });
  });

  it('rejects insufficient funds without replacing state', () => {
    const wallet = createWallet(20);
    const result = debitWallet(wallet, 21);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'insufficient_funds' },
    });
    expect(result.state).toBe(wallet);
  });

  it('rejects invalid debit and credit amounts', () => {
    const wallet = createWallet(20);

    expect(debitWallet(wallet, 0)).toMatchObject({
      ok: false,
      error: { code: 'invalid_coin_amount' },
    });
    expect(creditWallet(wallet, -1)).toMatchObject({
      ok: false,
      error: { code: 'invalid_coin_amount' },
    });
  });

  it('rejects balances above the safe integer range', () => {
    const wallet = createWallet(Number.MAX_SAFE_INTEGER);
    const result = creditWallet(wallet, 1);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'coin_overflow' },
    });
    expect(result.state).toBe(wallet);
  });
});
