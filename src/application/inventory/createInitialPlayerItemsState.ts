import type { ContentCatalog } from '../../data/content/contentCatalog.js';
import {
  addPlayerItem,
  bindToolbarItem,
  createEmptyPlayerItemsState,
  type PlayerItemsState,
} from '../../domain/inventory/playerItemsState.js';

const STARTING_ITEMS = Object.freeze([
  Object.freeze({ itemId: 'tool.hoe', quantity: 1 }),
  Object.freeze({ itemId: 'tool.watering-can', quantity: 1 }),
  Object.freeze({ itemId: 'seed.turnip', quantity: 5 }),
]);

const STARTING_TOOLBAR = Object.freeze([
  'tool.hoe',
  'tool.watering-can',
  'seed.turnip',
] as const);

export function createInitialPlayerItemsState(
  catalog: ContentCatalog,
): PlayerItemsState {
  let state = createEmptyPlayerItemsState();

  for (const startingItem of STARTING_ITEMS) {
    const item = catalog.requireItem(startingItem.itemId);
    const result = addPlayerItem(
      state,
      item.id,
      startingItem.quantity,
      item.stackLimit,
    );

    if (!result.ok) {
      throw new Error(
        `Could not create starting item "${item.id}": ${result.error.message}`,
      );
    }

    state = result.state;
  }

  for (const [slotIndex, itemId] of STARTING_TOOLBAR.entries()) {
    const result = bindToolbarItem(state, slotIndex, itemId);

    if (!result.ok) {
      throw new Error(
        `Could not bind starting item "${itemId}": ${result.error.message}`,
      );
    }

    state = result.state;
  }

  return state;
}
