export type WalletState = Readonly<{
  coins: number;
}>;

export type WalletErrorCode =
  | 'coin_overflow'
  | 'insufficient_funds'
  | 'invalid_coin_amount';

export type WalletFailure = Readonly<{
  ok: false;
  state: WalletState;
  error: Readonly<{
    code: WalletErrorCode;
    amount: number;
    message: string;
  }>;
}>;

export type WalletSuccess = Readonly<{
  ok: true;
  state: WalletState;
}>;

export type WalletResult = WalletFailure | WalletSuccess;

function isValidCoinAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount >= 0;
}

function failure(
  state: WalletState,
  code: WalletErrorCode,
  amount: number,
  message: string,
): WalletFailure {
  return Object.freeze({
    ok: false,
    state,
    error: Object.freeze({ code, amount, message }),
  });
}

export function createWallet(coins: number): WalletState {
  if (!isValidCoinAmount(coins)) {
    throw new Error('Wallet coins must be a non-negative safe integer.');
  }

  return Object.freeze({ coins });
}

export function debitWallet(
  state: WalletState,
  amount: number,
): WalletResult {
  if (!isValidCoinAmount(amount) || amount === 0) {
    return failure(
      state,
      'invalid_coin_amount',
      amount,
      'Wallet debit amount must be a positive safe integer.',
    );
  }

  if (state.coins < amount) {
    return failure(
      state,
      'insufficient_funds',
      amount,
      `Wallet has ${String(state.coins)} coins but ${String(amount)} are required.`,
    );
  }

  return Object.freeze({ ok: true, state: createWallet(state.coins - amount) });
}

export function creditWallet(
  state: WalletState,
  amount: number,
): WalletResult {
  if (!isValidCoinAmount(amount) || amount === 0) {
    return failure(
      state,
      'invalid_coin_amount',
      amount,
      'Wallet credit amount must be a positive safe integer.',
    );
  }

  const nextCoins = state.coins + amount;
  if (!Number.isSafeInteger(nextCoins)) {
    return failure(
      state,
      'coin_overflow',
      amount,
      'Wallet credit would exceed the maximum safe coin balance.',
    );
  }

  return Object.freeze({ ok: true, state: createWallet(nextCoins) });
}
