import {
  createInventory,
  INVENTORY_SLOT_COUNT,
  type InventorySlot,
} from '../inventory/inventoryState.js';
import {
  createPlayerItemsState,
  TOOLBAR_SLOT_COUNT,
  type PlayerItemsState,
  type ToolbarBinding,
} from '../inventory/playerItemsState.js';

type UnknownRecord = Record<string, unknown>;

export type DecodePlayerItemsResult =
  | Readonly<{ ok: true; playerItems: PlayerItemsState }>
  | Readonly<{ ok: false; error: string }>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeInventorySlot(
  value: unknown,
  index: number,
): InventorySlot | string {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return `Inventory slot ${String(index)} must be null or an object.`;
  }

  if (typeof value.itemId !== 'string' || value.itemId.trim().length === 0) {
    return `Inventory slot ${String(index)} itemId must be a non-empty string.`;
  }

  if (
    typeof value.quantity !== 'number' ||
    !Number.isSafeInteger(value.quantity) ||
    value.quantity < 1
  ) {
    return `Inventory slot ${String(index)} quantity must be a positive safe integer.`;
  }

  return Object.freeze({
    itemId: value.itemId.trim(),
    quantity: value.quantity,
  });
}

function decodeToolbarBinding(
  value: unknown,
  index: number,
): ToolbarBinding | string {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return `Toolbar binding ${String(index)} must be null or a non-empty string.`;
  }

  return value.trim();
}

export function decodePlayerItems(value: unknown): DecodePlayerItemsResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Save playerItems must be an object.' };
  }

  if (!Array.isArray(value.inventorySlots)) {
    return { ok: false, error: 'Save inventorySlots must be an array.' };
  }

  if (value.inventorySlots.length !== INVENTORY_SLOT_COUNT) {
    return {
      ok: false,
      error: `Save inventory must contain exactly ${String(INVENTORY_SLOT_COUNT)} slots.`,
    };
  }

  if (!Array.isArray(value.toolbarBindings)) {
    return { ok: false, error: 'Save toolbarBindings must be an array.' };
  }

  if (value.toolbarBindings.length !== TOOLBAR_SLOT_COUNT) {
    return {
      ok: false,
      error: `Save toolbar must contain exactly ${String(TOOLBAR_SLOT_COUNT)} bindings.`,
    };
  }

  if (
    typeof value.selectedSlotIndex !== 'number' ||
    !Number.isInteger(value.selectedSlotIndex) ||
    value.selectedSlotIndex < 0 ||
    value.selectedSlotIndex >= TOOLBAR_SLOT_COUNT
  ) {
    return {
      ok: false,
      error: 'Save selectedSlotIndex must reference a valid toolbar slot.',
    };
  }

  const inventorySlots: InventorySlot[] = [];
  for (const [index, slotValue] of value.inventorySlots.entries()) {
    const slot = decodeInventorySlot(slotValue, index);
    if (typeof slot === 'string') {
      return { ok: false, error: slot };
    }
    inventorySlots.push(slot);
  }

  const toolbarBindings: ToolbarBinding[] = [];
  for (const [index, bindingValue] of value.toolbarBindings.entries()) {
    const binding = decodeToolbarBinding(bindingValue, index);
    if (typeof binding === 'string' && bindingValue !== binding) {
      return { ok: false, error: binding };
    }
    toolbarBindings.push(binding as ToolbarBinding);
  }

  try {
    return {
      ok: true,
      playerItems: createPlayerItemsState({
        inventory: createInventory(inventorySlots),
        toolbarBindings,
        selectedSlotIndex: value.selectedSlotIndex,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function encodePlayerItems(state: PlayerItemsState): Readonly<{
  inventorySlots: readonly InventorySlot[];
  toolbarBindings: readonly ToolbarBinding[];
  selectedSlotIndex: number;
}> {
  return Object.freeze({
    inventorySlots: state.inventory.slots,
    toolbarBindings: state.toolbar.bindings,
    selectedSlotIndex: state.toolbar.selectedSlotIndex,
  });
}
