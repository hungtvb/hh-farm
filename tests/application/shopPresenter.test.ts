import { describe, expect, it } from 'vitest';
import { createEconomyCatalogPort } from '../../src/application/economy/createEconomyCatalogPort.js';
import {
  createInitialEconomyState,
  INITIAL_COIN_BALANCE,
} from '../../src/application/economy/createInitialEconomyState.js';
import { presentShop } from '../../src/application/economy/shopPresenter.js';
import { gameContentCatalog } from '../../src/data/content/index.js';
import { createEconomyState } from '../../src/domain/economy/economyState.js';
import { createWallet } from '../../src/domain/economy/walletState.js';
import {
  createInventory,
  INVENTORY_SLOT_COUNT,
  type InventorySlot,
} from '../../src/domain/inventory/inventoryState.js';
import { createPlayerItemsState } from '../../src/domain/inventory/playerItemsState.js';

const catalog = createEconomyCatalogPort(gameContentCatalog);

function createFullKnownInventory() {
  const slots = Array.from<InventorySlot>(
    { length: INVENTORY_SLOT_COUNT },
    () => Object.freeze({ itemId: 'tool.hoe', quantity: 1 }),
  );

  return createPlayerItemsState({ inventory: createInventory(slots) });
}

describe('economy catalog adapter', () => {
  it('exposes validated items and shop offers', () => {
    expect(catalog.listShopOffers()).toHaveLength(3);
    expect(catalog.getShopOffer('shop.seed.carrot')).toMatchObject({
      itemId: 'seed.carrot',
      quantity: 1,
      buyPrice: 35,
      unlockDay: 1,
    });
    expect(catalog.getItem('produce.strawberry')).toMatchObject({
      stackLimit: 99,
      sellPrice: 90,
    });
  });
});

describe('initial economy state', () => {
  it('uses the shared starting player items and coin fixture', () => {
    const state = createInitialEconomyState(gameContentCatalog);

    expect(state.wallet.coins).toBe(INITIAL_COIN_BALANCE);
    expect(state.wallet.coins).toBe(250);
    expect(state.playerItems.toolbar.bindings.slice(0, 5)).toEqual([
      'tool.hoe',
      'tool.watering-can',
      'seed.turnip',
      'seed.carrot',
      'seed.strawberry',
    ]);
  });
});

describe('presentShop', () => {
  it('projects catalog prices, localized labels and day locks', () => {
    const state = createInitialEconomyState(gameContentCatalog);
    const view = presentShop(
      state,
      catalog,
      1,
      (itemId, sourceName) =>
        itemId === 'seed.turnip' ? 'Hạt củ cải' : sourceName,
    );

    expect(view.coins).toBe(250);
    expect(view.offers).toHaveLength(3);
    expect(view.offers[0]).toEqual({
      offerId: 'shop.seed.turnip',
      itemId: 'seed.turnip',
      displayName: 'Hạt củ cải',
      spriteKey: 'item.seed.turnip',
      quantity: 1,
      buyPrice: 20,
      unlockDay: 1,
      disabled: false,
      disabledReason: null,
    });
    expect(view.offers[2]).toMatchObject({
      offerId: 'shop.seed.strawberry',
      buyPrice: 65,
      disabled: true,
      disabledReason: 'offer_locked',
    });
  });

  it('uses transaction rules for insufficient funds and inventory capacity', () => {
    const emptyWallet = createEconomyState(
      createWallet(0),
      createInitialEconomyState(gameContentCatalog).playerItems,
    );
    const noFunds = presentShop(emptyWallet, catalog, 1);
    expect(noFunds.offers[0]).toMatchObject({
      disabled: true,
      disabledReason: 'insufficient_funds',
    });

    const fullInventory = createEconomyState(
      createWallet(250),
      createFullKnownInventory(),
    );
    const noCapacity = presentShop(fullInventory, catalog, 1);
    expect(noCapacity.offers[0]).toMatchObject({
      disabled: true,
      disabledReason: 'inventory_full',
    });
  });

  it('aggregates inventory quantities and disables unsellable tools', () => {
    const state = createInitialEconomyState(gameContentCatalog);
    const view = presentShop(state, catalog, 3);

    expect(view.inventory).toHaveLength(5);
    expect(view.inventory.find((item) => item.itemId === 'seed.turnip')).toMatchObject({
      quantity: 5,
      sellPrice: 5,
      disabled: false,
      disabledReason: null,
    });
    expect(view.inventory.find((item) => item.itemId === 'tool.hoe')).toMatchObject({
      quantity: 1,
      sellPrice: 0,
      disabled: true,
      disabledReason: 'item_not_sellable',
    });
  });
});
