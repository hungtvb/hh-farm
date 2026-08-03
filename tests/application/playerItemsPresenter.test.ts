import { describe, expect, it } from 'vitest';
import { createInitialPlayerItemsState } from '../../src/application/inventory/createInitialPlayerItemsState.js';
import { presentPlayerItems } from '../../src/application/inventory/playerItemsPresenter.js';
import { gameContentCatalog } from '../../src/data/content/index.js';
import { countInventoryItem } from '../../src/domain/inventory/inventoryState.js';
import {
  bindToolbarItem,
  removePlayerItem,
  selectToolbarSlot,
} from '../../src/domain/inventory/playerItemsState.js';

describe('initial player items', () => {
  it('uses validated catalog limits and reserves advanced seeds for unlocks', () => {
    const state = createInitialPlayerItemsState(gameContentCatalog);

    expect(state.inventory.slots).toHaveLength(12);
    expect(state.toolbar.bindings).toEqual([
      'tool.hoe',
      'tool.watering-can',
      'seed.turnip',
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(countInventoryItem(state.inventory, 'tool.hoe')).toBe(1);
    expect(countInventoryItem(state.inventory, 'tool.watering-can')).toBe(1);
    expect(countInventoryItem(state.inventory, 'seed.turnip')).toBe(5);
    expect(countInventoryItem(state.inventory, 'seed.carrot')).toBe(0);
    expect(countInventoryItem(state.inventory, 'seed.strawberry')).toBe(0);
  });
});

describe('presentPlayerItems', () => {
  it('projects all twelve inventory slots and eight toolbar bindings', () => {
    const state = createInitialPlayerItemsState(gameContentCatalog);
    const view = presentPlayerItems(state, gameContentCatalog);

    expect(view.inventorySlots).toHaveLength(12);
    expect(view.toolbarSlots).toHaveLength(8);
    expect(view.inventorySlots[0]).toEqual({
      slotIndex: 0,
      item: {
        itemId: 'tool.hoe',
        displayName: 'Hoe',
        category: 'tool',
        spriteKey: 'item.tool.hoe',
        quantity: 1,
        stackLimit: 1,
      },
    });
    expect(view.toolbarSlots[0]).toMatchObject({
      slotIndex: 0,
      selected: true,
      item: { itemId: 'tool.hoe', quantity: 1 },
    });
    expect(view.selectedItem).toMatchObject({
      itemId: 'tool.hoe',
      quantity: 1,
    });
  });

  it('applies presentation-only item labels without changing catalog IDs', () => {
    const state = createInitialPlayerItemsState(gameContentCatalog);
    const view = presentPlayerItems(
      state,
      gameContentCatalog,
      (itemId, sourceName) =>
        itemId === 'tool.hoe' ? 'Cuốc' : sourceName,
    );

    expect(view.inventorySlots[0]?.item).toMatchObject({
      itemId: 'tool.hoe',
      displayName: 'Cuốc',
    });
    expect(view.toolbarSlots[0]?.item).toMatchObject({
      itemId: 'tool.hoe',
      displayName: 'Cuốc',
    });
    expect(gameContentCatalog.requireItem('tool.hoe').displayName).toBe('Hoe');
  });

  it('uses total quantity for toolbar bindings across inventory stacks', () => {
    let state = createInitialPlayerItemsState(gameContentCatalog);
    const bound = bindToolbarItem(state, 5, 'seed.turnip');
    expect(bound.ok).toBe(true);
    if (!bound.ok) {
      throw new Error(bound.error.message);
    }
    state = bound.state;

    const selected = selectToolbarSlot(state, 5);
    expect(selected.ok).toBe(true);
    if (!selected.ok) {
      throw new Error(selected.error.message);
    }

    const view = presentPlayerItems(selected.state, gameContentCatalog);
    expect(view.toolbarSlots[5]).toMatchObject({
      selected: true,
      item: { itemId: 'seed.turnip', quantity: 5 },
    });
    expect(view.selectedItem).toMatchObject({
      itemId: 'seed.turnip',
      quantity: 5,
    });
  });

  it('clears every toolbar binding after the final item is consumed', () => {
    let state = createInitialPlayerItemsState(gameContentCatalog);
    const bound = bindToolbarItem(state, 4, 'seed.turnip');
    expect(bound.ok).toBe(true);
    if (!bound.ok) {
      throw new Error(bound.error.message);
    }
    state = bound.state;

    const removed = removePlayerItem(state, 'seed.turnip', 5);
    expect(removed.ok).toBe(true);
    if (!removed.ok) {
      throw new Error(removed.error.message);
    }
    state = removed.state;

    const view = presentPlayerItems(state, gameContentCatalog);
    expect(view.toolbarSlots[2]).toEqual({
      slotIndex: 2,
      selected: false,
      item: null,
    });
    expect(view.toolbarSlots[4]).toEqual({
      slotIndex: 4,
      selected: false,
      item: null,
    });
    expect(
      view.inventorySlots.some((slot) => slot.item?.itemId === 'seed.turnip'),
    ).toBe(false);
  });
});
