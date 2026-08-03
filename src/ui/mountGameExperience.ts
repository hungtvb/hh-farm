import { createInitialPlayerItemsState } from '../application/inventory/createInitialPlayerItemsState.js';
import { presentPlayerItems } from '../application/inventory/playerItemsPresenter.js';
import { gameContentCatalog } from '../data/content/index.js';
import {
  bindToolbarItem,
  selectToolbarSlot,
  type PlayerItemsState,
} from '../domain/inventory/playerItemsState.js';
import {
  mountGameHud,
  type GameHudController,
} from './gameHud.js';

export type GameExperienceController = Readonly<{
  hud: GameHudController;
  getPlayerItemsState: () => PlayerItemsState;
}>;

export function mountGameExperience(
  appRoot: HTMLElement,
): GameExperienceController {
  let playerItems = createInitialPlayerItemsState(gameContentCatalog);
  let hud: GameHudController | undefined;

  const refresh = (): void => {
    hud?.renderPlayerItems(
      presentPlayerItems(playerItems, gameContentCatalog),
    );
  };

  hud = mountGameHud(appRoot, undefined, {
    onSelectToolbarSlot: (slotIndex) => {
      const result = selectToolbarSlot(playerItems, slotIndex);
      if (result.ok) {
        playerItems = result.state;
        refresh();
      }
    },
    onBindInventoryItem: (itemId) => {
      const result = bindToolbarItem(
        playerItems,
        playerItems.toolbar.selectedSlotIndex,
        itemId,
      );
      if (result.ok) {
        playerItems = result.state;
        refresh();
      }
    },
  });
  refresh();

  return Object.freeze({
    hud,
    getPlayerItemsState: () => playerItems,
  });
}
