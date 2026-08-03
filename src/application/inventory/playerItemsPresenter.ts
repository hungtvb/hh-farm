import type { ContentCatalog } from '../../data/content/contentCatalog.js';
import {
  countInventoryItem,
  type InventorySlot,
} from '../../domain/inventory/inventoryState.js';
import type { PlayerItemsState } from '../../domain/inventory/playerItemsState.js';

export type ItemSlotViewModel = Readonly<{
  itemId: string;
  displayName: string;
  category: 'material' | 'produce' | 'seed' | 'tool';
  spriteKey: string;
  quantity: number;
  stackLimit: number;
}>;

export type InventorySlotViewModel = Readonly<{
  slotIndex: number;
  item: ItemSlotViewModel | null;
}>;

export type ToolbarSlotViewModel = Readonly<{
  slotIndex: number;
  selected: boolean;
  item: ItemSlotViewModel | null;
}>;

export type PlayerItemsViewModel = Readonly<{
  inventorySlots: readonly InventorySlotViewModel[];
  toolbarSlots: readonly ToolbarSlotViewModel[];
  selectedItem: ItemSlotViewModel | null;
}>;

function toItemView(
  slot: Exclude<InventorySlot, null>,
  catalog: ContentCatalog,
): ItemSlotViewModel {
  const item = catalog.requireItem(slot.itemId);

  return Object.freeze({
    itemId: item.id,
    displayName: item.displayName,
    category: item.category,
    spriteKey: item.spriteKey,
    quantity: slot.quantity,
    stackLimit: item.stackLimit,
  });
}

function toToolbarItemView(
  itemId: string,
  state: PlayerItemsState,
  catalog: ContentCatalog,
): ItemSlotViewModel {
  const item = catalog.requireItem(itemId);

  return Object.freeze({
    itemId: item.id,
    displayName: item.displayName,
    category: item.category,
    spriteKey: item.spriteKey,
    quantity: countInventoryItem(state.inventory, item.id),
    stackLimit: item.stackLimit,
  });
}

export function presentPlayerItems(
  state: PlayerItemsState,
  catalog: ContentCatalog,
): PlayerItemsViewModel {
  const inventorySlots = Object.freeze(
    state.inventory.slots.map((slot, slotIndex) =>
      Object.freeze({
        slotIndex,
        item: slot === null ? null : toItemView(slot, catalog),
      }),
    ),
  );
  const toolbarSlots = Object.freeze(
    state.toolbar.bindings.map((itemId, slotIndex) =>
      Object.freeze({
        slotIndex,
        selected: slotIndex === state.toolbar.selectedSlotIndex,
        item:
          itemId === null
            ? null
            : toToolbarItemView(itemId, state, catalog),
      }),
    ),
  );
  const selectedItem =
    toolbarSlots[state.toolbar.selectedSlotIndex]?.item ?? null;

  return Object.freeze({
    inventorySlots,
    toolbarSlots,
    selectedItem,
  });
}
