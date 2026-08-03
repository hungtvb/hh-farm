import { describe, expect, it } from 'vitest';
import type { EconomyCatalogPort } from '../../src/domain/economy/economyPorts.js';
import {
  buyShopOffer,
  createEconomyState,
  sellInventoryItem,
} from '../../src/domain/economy/economyState.js';
import { createWallet } from '../../src/domain/economy/walletState.js';
import {
  countInventoryItem,
  createInventory,
  INVENTORY_SLOT_COUNT,
  type InventorySlot,
} from '../../src/domain/inventory/inventoryState.js';
import {
  addPlayerItem,
  bindToolbarItem,
  createEmptyPlayerItemsState,
  createPlayerItemsState,
  type PlayerItemsState,
} from '../../src/domain/inventory/playerItemsState.js';

const ITEMS = Object.freeze([
  Object.freeze({
    id: 'seed.turnip',
    displayName: 'Turnip Seeds',
    category: 'seed' as const,
    spriteKey: 'item.seed.turnip',
    stackLimit: 99,
    sellPrice: 5,
  }),
  Object.freeze({
    id: 'produce.turnip',
    displayName: 'Turnip',
    category: 'produce' as const,
    spriteKey: 'item.produce.turnip',
    stackLimit: 99,
    sellPrice: 35,
  }),
  Object.freeze({
    id: 'tool.hoe',
    displayName: 'Hoe',
    category: 'tool' as const,
    spriteKey: 'item.tool.hoe',
    stackLimit: 1,
    sellPrice: 0,
  }),
]);

const OFFERS = Object.freeze([
  Object.freeze({
    id: 'shop.seed.turnip',
    itemId: 'seed.turnip',
    quantity: 1,
    buyPrice: 20,
    unlockDay: 1,
  }),
  Object.freeze({
    id: 'shop.seed.turnip-late',
    itemId: 'seed.turnip',
    quantity: 2,
    buyPrice: 35,
    unlockDay: 3,
  }),
]);

const catalog: EconomyCatalogPort = Object.freeze({
  getItem: (itemId) => ITEMS.find((item) => item.id === itemId),
  getShopOffer: (offerId) => OFFERS.find((offer) => offer.id === offerId),
  listShopOffers: () => OFFERS,
});

function withItem(
  itemId: string,
  quantity: number,
  bindSlot?: number,
): PlayerItemsState {
  const item = ITEMS.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    throw new Error(`Missing test item: ${itemId}`);
  }

  const added = addPlayerItem(
    createEmptyPlayerItemsState(),
    item.id,
    quantity,
    item.stackLimit,
  );
  if (!added.ok) {
    throw new Error(added.error.message);
  }

  if (bindSlot === undefined) {
    return added.state;
  }

  const bound = bindToolbarItem(added.state, bindSlot, item.id);
  if (!bound.ok) {
    throw new Error(bound.error.message);
  }

  return bound.state;
}

function createFullPlayerItems(): PlayerItemsState {
  const slots = Array.from<InventorySlot>(
    { length: INVENTORY_SLOT_COUNT },
    (_, index) =>
      Object.freeze({ itemId: `material.${String(index)}`, quantity: 1 }),
  );

  return createPlayerItemsState({ inventory: createInventory(slots) });
}

describe('buyShopOffer', () => {
  it('buys with the exact balance and leaves the wallet at zero', () => {
    const state = createEconomyState(
      createWallet(20),
      createEmptyPlayerItemsState(),
    );
    const result = buyShopOffer(state, catalog, {
      offerId: 'shop.seed.turnip',
      purchaseCount: 1,
      currentDay: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.wallet.coins).toBe(0);
    expect(countInventoryItem(result.state.playerItems.inventory, 'seed.turnip')).toBe(1);
    expect(result.events).toEqual([
      {
        type: 'item-bought',
        offerId: 'shop.seed.turnip',
        itemId: 'seed.turnip',
        quantity: 1,
        cost: 20,
        balance: 0,
      },
    ]);
  });

  it('supports deterministic multi-offer purchases', () => {
    const state = createEconomyState(
      createWallet(60),
      createEmptyPlayerItemsState(),
    );
    const result = buyShopOffer(state, catalog, {
      offerId: 'shop.seed.turnip',
      purchaseCount: 3,
      currentDay: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.wallet.coins).toBe(0);
    expect(countInventoryItem(result.state.playerItems.inventory, 'seed.turnip')).toBe(3);
  });

  it('rejects insufficient funds without changing wallet or inventory', () => {
    const state = createEconomyState(
      createWallet(19),
      createEmptyPlayerItemsState(),
    );
    const result = buyShopOffer(state, catalog, {
      offerId: 'shop.seed.turnip',
      purchaseCount: 1,
      currentDay: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'insufficient_funds' },
      events: [],
    });
    expect(result.state).toBe(state);
    expect(result.state.wallet).toBe(state.wallet);
    expect(result.state.playerItems).toBe(state.playerItems);
  });

  it('rejects a full inventory without debiting the wallet', () => {
    const state = createEconomyState(createWallet(100), createFullPlayerItems());
    const result = buyShopOffer(state, catalog, {
      offerId: 'shop.seed.turnip',
      purchaseCount: 1,
      currentDay: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'inventory_full' },
    });
    expect(result.state).toBe(state);
    expect(result.state.wallet.coins).toBe(100);
  });

  it('rejects locked offers and invalid quantities atomically', () => {
    const state = createEconomyState(
      createWallet(100),
      createEmptyPlayerItemsState(),
    );
    const locked = buyShopOffer(state, catalog, {
      offerId: 'shop.seed.turnip-late',
      purchaseCount: 1,
      currentDay: 2,
    });
    const invalid = buyShopOffer(state, catalog, {
      offerId: 'shop.seed.turnip',
      purchaseCount: 0,
      currentDay: 1,
    });

    expect(locked).toMatchObject({
      ok: false,
      error: { code: 'offer_locked' },
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: 'invalid_quantity' },
    });
    expect(locked.state).toBe(state);
    expect(invalid.state).toBe(state);
  });
});

describe('sellInventoryItem', () => {
  it('removes produce and credits catalog sell price', () => {
    const state = createEconomyState(
      createWallet(10),
      withItem('produce.turnip', 3),
    );
    const result = sellInventoryItem(state, catalog, {
      itemId: 'produce.turnip',
      quantity: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.wallet.coins).toBe(80);
    expect(countInventoryItem(result.state.playerItems.inventory, 'produce.turnip')).toBe(1);
    expect(result.events).toEqual([
      {
        type: 'item-sold',
        itemId: 'produce.turnip',
        quantity: 2,
        revenue: 70,
        balance: 80,
      },
    ]);
  });

  it('clears toolbar bindings when the sold item reaches zero', () => {
    const state = createEconomyState(
      createWallet(0),
      withItem('produce.turnip', 1, 6),
    );
    const result = sellInventoryItem(state, catalog, {
      itemId: 'produce.turnip',
      quantity: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.playerItems.toolbar.bindings[6]).toBeNull();
    expect(result.state.playerItems.toolbar.selectedSlotIndex).toBe(0);
  });

  it('rejects missing and unsellable items without crediting coins', () => {
    const missingState = createEconomyState(
      createWallet(10),
      createEmptyPlayerItemsState(),
    );
    const missing = sellInventoryItem(missingState, catalog, {
      itemId: 'produce.turnip',
      quantity: 1,
    });

    const toolState = createEconomyState(
      createWallet(10),
      withItem('tool.hoe', 1),
    );
    const unsellable = sellInventoryItem(toolState, catalog, {
      itemId: 'tool.hoe',
      quantity: 1,
    });

    expect(missing).toMatchObject({
      ok: false,
      error: { code: 'item_not_owned' },
    });
    expect(unsellable).toMatchObject({
      ok: false,
      error: { code: 'item_not_sellable' },
    });
    expect(missing.state).toBe(missingState);
    expect(unsellable.state).toBe(toolState);
  });

  it('rejects coin overflow without removing inventory', () => {
    const state = createEconomyState(
      createWallet(Number.MAX_SAFE_INTEGER),
      withItem('produce.turnip', 1),
    );
    const result = sellInventoryItem(state, catalog, {
      itemId: 'produce.turnip',
      quantity: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'coin_overflow' },
    });
    expect(result.state).toBe(state);
    expect(countInventoryItem(result.state.playerItems.inventory, 'produce.turnip')).toBe(1);
  });
});
