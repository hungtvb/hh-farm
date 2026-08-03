import {
  addPlayerItem,
  removePlayerItem,
  type PlayerItemsState,
} from '../inventory/playerItemsState.js';
import type { EconomyCatalogPort } from './economyPorts.js';
import {
  creditWallet,
  debitWallet,
  type WalletState,
} from './walletState.js';

export type EconomyState = Readonly<{
  wallet: WalletState;
  playerItems: PlayerItemsState;
}>;

export type EconomyTransactionErrorCode =
  | 'coin_overflow'
  | 'insufficient_funds'
  | 'invalid_day'
  | 'invalid_quantity'
  | 'inventory_full'
  | 'item_not_owned'
  | 'item_not_sellable'
  | 'offer_locked'
  | 'transaction_overflow'
  | 'unknown_item'
  | 'unknown_offer';

export type ItemBoughtEvent = Readonly<{
  type: 'item-bought';
  offerId: string;
  itemId: string;
  quantity: number;
  cost: number;
  balance: number;
}>;

export type ItemSoldEvent = Readonly<{
  type: 'item-sold';
  itemId: string;
  quantity: number;
  revenue: number;
  balance: number;
}>;

export type EconomyTransactionEvent = ItemBoughtEvent | ItemSoldEvent;

export type EconomyTransactionFailure = Readonly<{
  ok: false;
  state: EconomyState;
  events: readonly [];
  error: Readonly<{
    code: EconomyTransactionErrorCode;
    message: string;
  }>;
}>;

export type EconomyTransactionSuccess = Readonly<{
  ok: true;
  state: EconomyState;
  events: readonly [EconomyTransactionEvent];
}>;

export type EconomyTransactionResult =
  | EconomyTransactionFailure
  | EconomyTransactionSuccess;

const EMPTY_EVENTS: readonly [] = Object.freeze([]);

export function createEconomyState(
  wallet: WalletState,
  playerItems: PlayerItemsState,
): EconomyState {
  return Object.freeze({ wallet, playerItems });
}

function failure(
  state: EconomyState,
  code: EconomyTransactionErrorCode,
  message: string,
): EconomyTransactionFailure {
  return Object.freeze({
    ok: false,
    state,
    events: EMPTY_EVENTS,
    error: Object.freeze({ code, message }),
  });
}

function success(
  state: EconomyState,
  event: EconomyTransactionEvent,
): EconomyTransactionSuccess {
  return Object.freeze({
    ok: true,
    state,
    events: Object.freeze([Object.freeze(event)]),
  });
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function multiplyTransactionValue(
  left: number,
  right: number,
): number | undefined {
  const result = left * right;
  return Number.isSafeInteger(result) && result > 0 ? result : undefined;
}

export function buyShopOffer(
  state: EconomyState,
  catalog: EconomyCatalogPort,
  command: Readonly<{
    offerId: string;
    purchaseCount: number;
    currentDay: number;
  }>,
): EconomyTransactionResult {
  if (!isPositiveSafeInteger(command.purchaseCount)) {
    return failure(
      state,
      'invalid_quantity',
      'Purchase count must be a positive safe integer.',
    );
  }

  if (!isPositiveSafeInteger(command.currentDay)) {
    return failure(
      state,
      'invalid_day',
      'Current day must be a positive safe integer.',
    );
  }

  const offer = catalog.getShopOffer(command.offerId);
  if (offer === undefined) {
    return failure(
      state,
      'unknown_offer',
      `Unknown shop offer: "${command.offerId}".`,
    );
  }

  if (command.currentDay < offer.unlockDay) {
    return failure(
      state,
      'offer_locked',
      `Shop offer "${offer.id}" unlocks on day ${String(offer.unlockDay)}.`,
    );
  }

  const item = catalog.getItem(offer.itemId);
  if (item === undefined) {
    return failure(
      state,
      'unknown_item',
      `Shop offer "${offer.id}" references unknown item "${offer.itemId}".`,
    );
  }

  const quantity = multiplyTransactionValue(
    offer.quantity,
    command.purchaseCount,
  );
  const cost = multiplyTransactionValue(offer.buyPrice, command.purchaseCount);
  if (quantity === undefined || cost === undefined) {
    return failure(
      state,
      'transaction_overflow',
      'Purchase quantity or cost exceeds the supported integer range.',
    );
  }

  if (state.wallet.coins < cost) {
    return failure(
      state,
      'insufficient_funds',
      `Purchase requires ${String(cost)} coins but wallet contains ${String(state.wallet.coins)}.`,
    );
  }

  const itemResult = addPlayerItem(
    state.playerItems,
    item.id,
    quantity,
    item.stackLimit,
  );
  if (!itemResult.ok) {
    return failure(
      state,
      itemResult.error.code === 'inventory_full'
        ? 'inventory_full'
        : 'transaction_overflow',
      itemResult.error.message,
    );
  }

  const walletResult = debitWallet(state.wallet, cost);
  if (!walletResult.ok) {
    return failure(
      state,
      walletResult.error.code === 'insufficient_funds'
        ? 'insufficient_funds'
        : 'transaction_overflow',
      walletResult.error.message,
    );
  }

  const nextState = createEconomyState(walletResult.state, itemResult.state);
  return success(nextState, {
    type: 'item-bought',
    offerId: offer.id,
    itemId: item.id,
    quantity,
    cost,
    balance: walletResult.state.coins,
  });
}

export function sellInventoryItem(
  state: EconomyState,
  catalog: EconomyCatalogPort,
  command: Readonly<{
    itemId: string;
    quantity: number;
  }>,
): EconomyTransactionResult {
  if (!isPositiveSafeInteger(command.quantity)) {
    return failure(
      state,
      'invalid_quantity',
      'Sale quantity must be a positive safe integer.',
    );
  }

  const item = catalog.getItem(command.itemId);
  if (item === undefined) {
    return failure(
      state,
      'unknown_item',
      `Unknown inventory item: "${command.itemId}".`,
    );
  }

  if (item.sellPrice <= 0) {
    return failure(
      state,
      'item_not_sellable',
      `Item "${item.id}" cannot be sold.`,
    );
  }

  const revenue = multiplyTransactionValue(item.sellPrice, command.quantity);
  if (revenue === undefined) {
    return failure(
      state,
      'transaction_overflow',
      'Sale revenue exceeds the supported integer range.',
    );
  }

  const itemResult = removePlayerItem(
    state.playerItems,
    item.id,
    command.quantity,
  );
  if (!itemResult.ok) {
    return failure(
      state,
      itemResult.error.code === 'item_not_found'
        ? 'item_not_owned'
        : 'transaction_overflow',
      itemResult.error.message,
    );
  }

  const walletResult = creditWallet(state.wallet, revenue);
  if (!walletResult.ok) {
    return failure(
      state,
      walletResult.error.code === 'coin_overflow'
        ? 'coin_overflow'
        : 'transaction_overflow',
      walletResult.error.message,
    );
  }

  const nextState = createEconomyState(walletResult.state, itemResult.state);
  return success(nextState, {
    type: 'item-sold',
    itemId: item.id,
    quantity: command.quantity,
    revenue,
    balance: walletResult.state.coins,
  });
}
