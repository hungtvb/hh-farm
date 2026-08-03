import type { ContentCatalog } from '../../data/content/contentCatalog.js';
import { createEconomyState, type EconomyState } from '../../domain/economy/economyState.js';
import { createWallet } from '../../domain/economy/walletState.js';
import { createInitialPlayerItemsState } from '../inventory/createInitialPlayerItemsState.js';

export const INITIAL_COIN_BALANCE = 250;

export function createInitialEconomyState(
  catalog: ContentCatalog,
): EconomyState {
  return createEconomyState(
    createWallet(INITIAL_COIN_BALANCE),
    createInitialPlayerItemsState(catalog),
  );
}
