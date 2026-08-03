import type { FarmingInventoryPort } from '../../domain/farming/farmingPorts.js';
import {
  countInventoryItem,
} from '../../domain/inventory/inventoryState.js';
import {
  addPlayerItem,
  removePlayerItem,
  type PlayerItemsState,
} from '../../domain/inventory/playerItemsState.js';

export function createFarmingInventoryPort(): FarmingInventoryPort<PlayerItemsState> {
  return Object.freeze({
    countItem: (state, itemId) =>
      countInventoryItem(state.inventory, itemId),
    removeItem: (state, itemId, quantity) => {
      const result = removePlayerItem(state, itemId, quantity);
      return result.ok ? result.state : undefined;
    },
    addItem: (state, itemId, quantity, stackLimit) => {
      const result = addPlayerItem(state, itemId, quantity, stackLimit);
      return result.ok ? result.state : undefined;
    },
  });
}
