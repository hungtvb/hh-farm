import { describe, expect, it } from 'vitest';
import {
  addInventoryItem,
  countInventoryItem,
  createEmptyInventory,
  createInventory,
  INVENTORY_SLOT_COUNT,
  removeInventoryItem,
  type InventorySlot,
} from '../../src/domain/inventory/inventoryState.js';

function createSlots(
  entries: Readonly<Record<number, InventorySlot>>,
): InventorySlot[] {
  const slots = Array<InventorySlot>(INVENTORY_SLOT_COUNT).fill(null);

  for (const [index, slot] of Object.entries(entries)) {
    slots[Number(index)] = slot;
  }

  return slots;
}

describe('inventory state', () => {
  it('creates exactly twelve empty slots', () => {
    const inventory = createEmptyInventory();

    expect(inventory.slots).toHaveLength(12);
    expect(inventory.slots.every((slot) => slot === null)).toBe(true);
  });

  it('rejects an invalid fixed slot count', () => {
    expect(() => createInventory([])).toThrow(
      'Inventory must contain exactly 12 slots.',
    );
  });

  it('counts an item across multiple stacks', () => {
    const inventory = createInventory(
      createSlots({
        0: { itemId: 'seed.turnip', quantity: 40 },
        4: { itemId: 'seed.turnip', quantity: 12 },
        8: { itemId: 'seed.carrot', quantity: 7 },
      }),
    );

    expect(countInventoryItem(inventory, 'seed.turnip')).toBe(52);
    expect(countInventoryItem(inventory, 'seed.carrot')).toBe(7);
    expect(countInventoryItem(inventory, 'missing')).toBe(0);
  });
});

describe('addInventoryItem', () => {
  it('fills existing stacks before using the first empty slot', () => {
    const inventory = createInventory(
      createSlots({
        0: { itemId: 'seed.turnip', quantity: 98 },
        2: { itemId: 'seed.carrot', quantity: 4 },
      }),
    );
    const result = addInventoryItem(inventory, 'seed.turnip', 2, 99);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.slots[0]).toEqual({
      itemId: 'seed.turnip',
      quantity: 99,
    });
    expect(result.state.slots[1]).toEqual({
      itemId: 'seed.turnip',
      quantity: 1,
    });
    expect(result.state.slots[2]).toBe(inventory.slots[2]);
    expect(result.changes.map((change) => change.slotIndex)).toEqual([0, 1]);
  });

  it('splits a large transaction deterministically across empty slots', () => {
    const inventory = createEmptyInventory();
    const result = addInventoryItem(inventory, 'produce.strawberry', 200, 99);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.slots.slice(0, 3)).toEqual([
      { itemId: 'produce.strawberry', quantity: 99 },
      { itemId: 'produce.strawberry', quantity: 99 },
      { itemId: 'produce.strawberry', quantity: 2 },
    ]);
  });

  it('returns the original state when total capacity is insufficient', () => {
    const inventory = createInventory(
      createSlots(
        Object.fromEntries(
          Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => [
            index,
            { itemId: `material.${String(index)}`, quantity: 1 },
          ]),
        ),
      ),
    );
    const result = addInventoryItem(inventory, 'seed.turnip', 1, 99);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'inventory_full' },
      changes: [],
    });
    expect(result.state).toBe(inventory);
  });

  it('rejects invalid quantity and stack limits without mutation', () => {
    const inventory = createEmptyInventory();
    const invalidQuantity = addInventoryItem(
      inventory,
      'seed.turnip',
      0,
      99,
    );
    const invalidLimit = addInventoryItem(
      inventory,
      'seed.turnip',
      1,
      0,
    );

    expect(invalidQuantity).toMatchObject({
      ok: false,
      error: { code: 'invalid_quantity' },
    });
    expect(invalidLimit).toMatchObject({
      ok: false,
      error: { code: 'invalid_stack_limit' },
    });
    expect(invalidQuantity.state).toBe(inventory);
    expect(invalidLimit.state).toBe(inventory);
  });
});

describe('removeInventoryItem', () => {
  it('removes from earlier stacks first and empties a consumed slot', () => {
    const inventory = createInventory(
      createSlots({
        0: { itemId: 'seed.turnip', quantity: 1 },
        1: { itemId: 'seed.turnip', quantity: 4 },
      }),
    );
    const result = removeInventoryItem(inventory, 'seed.turnip', 3);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.slots[0]).toBeNull();
    expect(result.state.slots[1]).toEqual({
      itemId: 'seed.turnip',
      quantity: 2,
    });
    expect(countInventoryItem(result.state, 'seed.turnip')).toBe(2);
  });

  it('removes the last item and returns the slot to empty state', () => {
    const inventory = createInventory(
      createSlots({ 3: { itemId: 'seed.carrot', quantity: 1 } }),
    );
    const result = removeInventoryItem(inventory, 'seed.carrot', 1);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(result.state.slots[3]).toBeNull();
    expect(countInventoryItem(result.state, 'seed.carrot')).toBe(0);
  });

  it('rejects a quantity larger than inventory without partial removal', () => {
    const inventory = createInventory(
      createSlots({ 0: { itemId: 'seed.turnip', quantity: 2 } }),
    );
    const result = removeInventoryItem(inventory, 'seed.turnip', 3);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'item_not_found' },
      changes: [],
    });
    expect(result.state).toBe(inventory);
    expect(result.state.slots[0]).toBe(inventory.slots[0]);
  });
});
