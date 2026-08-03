import { describe, expect, it } from 'vitest';
import { createFarmingInventoryPort } from '../../src/application/inventory/createFarmingInventoryPort.js';
import {
  createInventory,
  INVENTORY_SLOT_COUNT,
  type InventorySlot,
} from '../../src/domain/inventory/inventoryState.js';
import {
  createPlayerItemsState,
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

describe('farming inventory port', () => {
  it('counts and removes the final seed while clearing its toolbar binding', () => {
    const port = createFarmingInventoryPort();
    const state = createPlayerItemsState({
      inventory: createInventory(
        createSlots({ 0: { itemId: 'seed.turnip', quantity: 1 } }),
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

    expect(port.countItem(state, 'seed.turnip')).toBe(1);
    const next = port.removeItem(state, 'seed.turnip', 1);

    expect(next).toBeDefined();
    expect(next?.inventory.slots[0]).toBeNull();
    expect(next?.toolbar.bindings[0]).toBeNull();
    expect(port.countItem(next ?? state, 'seed.turnip')).toBe(0);
  });

  it('returns undefined when farming cannot add a harvest to a full inventory', () => {
    const port = createFarmingInventoryPort();
    const state = createPlayerItemsState({
      inventory: createInventory(
        Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => ({
          itemId: `material.${String(index)}`,
          quantity: 1,
        })),
      ),
    });

    expect(port.addItem(state, 'produce.turnip', 1, 99)).toBeUndefined();
    expect(state.inventory.slots).toHaveLength(12);
  });

  it('adds harvested items using the same existing-stack-first rule', () => {
    const port = createFarmingInventoryPort();
    const state = createPlayerItemsState({
      inventory: createInventory(
        createSlots({
          0: { itemId: 'produce.turnip', quantity: 98 },
          2: { itemId: 'tool.hoe', quantity: 1 },
        }),
      ),
    });
    const next = port.addItem(state, 'produce.turnip', 2, 99);

    expect(next?.inventory.slots[0]).toEqual({
      itemId: 'produce.turnip',
      quantity: 99,
    });
    expect(next?.inventory.slots[1]).toEqual({
      itemId: 'produce.turnip',
      quantity: 1,
    });
  });
});
