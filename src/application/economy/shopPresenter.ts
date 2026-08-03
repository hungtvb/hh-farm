import type { ItemLabelResolver } from '../inventory/playerItemsPresenter.js';
import type { EconomyCatalogPort } from '../../domain/economy/economyPorts.js';
import {
  buyShopOffer,
  type EconomyState,
  type EconomyTransactionErrorCode,
} from '../../domain/economy/economyState.js';
import { countInventoryItem } from '../../domain/inventory/inventoryState.js';
import {
  isSeedItemUnlocked,
  requiredLevelForSeedItem,
  type ProgressionState,
} from '../../domain/progression/progressionState.js';

export type ShopOfferDisabledReason =
  | 'insufficient_funds'
  | 'inventory_full'
  | 'offer_locked'
  | 'progression_locked';

export type ShopOfferViewModel = Readonly<{
  offerId: string;
  itemId: string;
  displayName: string;
  spriteKey: string;
  quantity: number;
  buyPrice: number;
  unlockDay: number;
  requiredLevel: 1 | 2 | 3 | null;
  disabled: boolean;
  disabledReason: ShopOfferDisabledReason | null;
}>;

export type SellItemViewModel = Readonly<{
  itemId: string;
  displayName: string;
  spriteKey: string;
  quantity: number;
  sellPrice: number;
  disabled: boolean;
  disabledReason: 'item_not_sellable' | null;
}>;

export type ShopViewModel = Readonly<{
  coins: number;
  currentDay: number;
  offers: readonly ShopOfferViewModel[];
  inventory: readonly SellItemViewModel[];
}>;

const keepSourceLabel: ItemLabelResolver = (_itemId, sourceName) => sourceName;

function mapBuyFailure(
  code: EconomyTransactionErrorCode,
): Exclude<ShopOfferDisabledReason, 'progression_locked'> {
  if (code === 'insufficient_funds') {
    return 'insufficient_funds';
  }
  if (code === 'inventory_full') {
    return 'inventory_full';
  }
  if (code === 'offer_locked') {
    return 'offer_locked';
  }

  throw new Error(`Shop offer cannot be presented: ${code}.`);
}

export function presentShop(
  state: EconomyState,
  catalog: EconomyCatalogPort,
  currentDay: number,
  resolveLabel: ItemLabelResolver = keepSourceLabel,
  progression?: ProgressionState,
): ShopViewModel {
  if (!Number.isSafeInteger(currentDay) || currentDay < 1) {
    throw new Error('Shop current day must be a positive safe integer.');
  }

  const offers = Object.freeze(
    catalog.listShopOffers().map((offer) => {
      const item = catalog.getItem(offer.itemId);
      if (item === undefined) {
        throw new Error(
          `Shop offer "${offer.id}" references unknown item "${offer.itemId}".`,
        );
      }

      const progressionLocked =
        progression !== undefined &&
        !isSeedItemUnlocked(progression, item.id);
      const availability = progressionLocked
        ? null
        : buyShopOffer(state, catalog, {
            offerId: offer.id,
            purchaseCount: 1,
            currentDay,
          });
      const disabledReason: ShopOfferDisabledReason | null = progressionLocked
        ? 'progression_locked'
        : availability?.ok === true
          ? null
          : availability === null
            ? null
            : mapBuyFailure(availability.error.code);

      return Object.freeze({
        offerId: offer.id,
        itemId: item.id,
        displayName: resolveLabel(item.id, item.displayName),
        spriteKey: item.spriteKey,
        quantity: offer.quantity,
        buyPrice: offer.buyPrice,
        unlockDay: offer.unlockDay,
        requiredLevel: requiredLevelForSeedItem(item.id),
        disabled: disabledReason !== null,
        disabledReason,
      });
    }),
  );

  const seenItemIds = new Set<string>();
  const inventory: SellItemViewModel[] = [];
  for (const slot of state.playerItems.inventory.slots) {
    if (slot === null || seenItemIds.has(slot.itemId)) {
      continue;
    }
    seenItemIds.add(slot.itemId);

    const item = catalog.getItem(slot.itemId);
    if (item === undefined) {
      throw new Error(`Inventory references unknown item "${slot.itemId}".`);
    }

    const sellable = item.sellPrice > 0;
    inventory.push(
      Object.freeze({
        itemId: item.id,
        displayName: resolveLabel(item.id, item.displayName),
        spriteKey: item.spriteKey,
        quantity: countInventoryItem(state.playerItems.inventory, item.id),
        sellPrice: item.sellPrice,
        disabled: !sellable,
        disabledReason: sellable ? null : 'item_not_sellable',
      }),
    );
  }

  return Object.freeze({
    coins: state.wallet.coins,
    currentDay,
    offers,
    inventory: Object.freeze(inventory),
  });
}
