import { describe, expect, it } from 'vitest';
import {
  createInventory,
  INVENTORY_SLOT_COUNT,
  type InventorySlot,
} from '../../src/domain/inventory/inventoryState.js';
import {
  addPlayerItem,
  bindToolbarItem,
  createEmptyPlayerItemsState,
  createPlayerItemsState,
  getSelectedToolbarItemId,
  removePlayerItem,
  selectToolbarSlot,
} from '../../src/domain/inventory/playerItemsState.js';

function createSlots(
  entries: Readonly<Record<number, InventorySlot>>,
): InventorySlot[] {
  const slots = Array<InventorySlot>(INVENTORY_SLOT_COUNT).fill(null);

  for (const [index, slot] of Object.entries(entries)) {
    slots[Number(index)] = slot;
  }

  return slots;
}

describe('player item state', () => {
  it('rejects toolbar bindings to items that are not owned', () => {
    expect(() =>
      createPlayerItemsState({
        inventory: createInventory(createSlots({})),
        toolbarBindings: [
          'seed.turnip',
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      }),
    ).toThrow('Toolbar item "seed.turnip" is not present in inventory.');
  });

  it('binds an owned item and resolves it from the selected slot', () => {
    const state = createPlayerItemsState({
      inventory: createInventory(
        createSlots({ 0: { itemId: 'tool.hoe', quantity: 1 } }),
      ),
    });
    const bound = bindToolbarItem(state, 2, 'tool.hoe');

    expect(bound.ok).toBe(true);
    if (!bound.ok) {
      throw new Error(bound.error.message);
    }

    const selected = selectToolbarSlot(bound.state, 2);
    expect(selected.ok).toBe(true);
    if (!selected.ok) {
      throw new Error(selected.error.message);
    }

    expect(selected.state.toolbar.selectedSlotIndex).toBe(2);
    expect(getSelectedToolbarItemId(selected.state)).toBe('tool.hoe');
    expect(state.toolbar.bindings[2]).toBeNull();
  });

  it('rejects invalid selection and binding without changing state', () => {
    const state = createEmptyPlayerItemsState();
    const selected = selectToolbarSlot(state, 8);
    const bound = bindToolbarItem(state, -1, null);
    const notOwned = bindToolbarItem(state, 0, 'seed.turnip');

    expect(selected).toMatchObject({
      ok: false,
      error: { code: 'invalid_toolbar_slot' },
    });
    expect(bound).toMatchObject({
      ok: false,
      error: { code: 'invalid_toolbar_slot' },
    });
    expect(notOwned).toMatchObject({
      ok: false,
      error: { code: 'item_not_owned' },
    });
    expect(selected.state).toBe(state);
    expect(bound.state).toBe(state);
    expect(notOwned.state).toBe(state);
  });

  it('keeps toolbar bindings while some quantity remains', () => {
    const state = createPlayerItemsState({
      inventory: createInventory(
        createSlots({ 0: { itemId: 'seed.turnip', quantity: 2 } }),
      ),
      toolbarBindings: [
        'seed.turnip',
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    });
    const result = removePlayerItem(state, 'seed.turnip', 1);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.inventory.slots[0]).toEqual({
      itemId: 'seed.turnip',
      quantity: 1,
    });
    expect(result.state.toolbar.bindings[0]).toBe('seed.turnip');
  });

  it('clears every toolbar binding after the last seed is consumed', () => {
    const state = createPlayerItemsState({
      inventory: createInventory(
        createSlots({ 4: { itemId: 'seed.carrot', quantity: 1 } }),
      ),
      toolbarBindings: [
        'seed.carrot',
        null,
        'seed.carrot',
        null,
        null,
        null,
        null,
        null,
      ],
      selectedSlotIndex: 2,
    });
    const result = removePlayerItem(state, 'seed.carrot', 1);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.inventory.slots[4]).toBeNull();
    expect(result.state.toolbar.bindings[0]).toBeNull();
    expect(result.state.toolbar.bindings[2]).toBeNull();
    expect(result.state.toolbar.selectedSlotIndex).toBe(2);
    expect(getSelectedToolbarItemId(result.state)).toBeNull();
  });

  it('shares an atomic inventory-full failure without replacing the aggregate', () => {
    const fullInventory = createInventory(
      Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => ({
        itemId: `material.${String(index)}`,
        quantity: 1,
      })),
    );
    const state = createPlayerItemsState({ inventory: fullInventory });
    const result = addPlayerItem(state, 'produce.turnip', 1, 99);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'inventory_full' },
    });
    expect(result.state).toBe(state);
  });
});
