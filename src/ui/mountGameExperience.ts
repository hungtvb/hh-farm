import { createEconomyCatalogPort } from '../application/economy/createEconomyCatalogPort.js';
import { createInitialEconomyState } from '../application/economy/createInitialEconomyState.js';
import { presentShop } from '../application/economy/shopPresenter.js';
import { presentPlayerItems } from '../application/inventory/playerItemsPresenter.js';
import { gameContentCatalog } from '../data/content/index.js';
import {
  buyShopOffer,
  createEconomyState,
  sellInventoryItem,
  type EconomyState,
  type EconomyTransactionErrorCode,
} from '../domain/economy/economyState.js';
import {
  bindToolbarItem,
  selectToolbarSlot,
  type PlayerItemsState,
} from '../domain/inventory/playerItemsState.js';
import {
  mountGameHud,
  type GameHudController,
} from './gameHud.js';
import { resolveVietnameseItemLabel } from './itemLabelsVi.js';
import { mountShopUi } from './shopUi.js';

export type GameExperienceController = Readonly<{
  hud: GameHudController;
  getEconomyState: () => EconomyState;
  getPlayerItemsState: () => PlayerItemsState;
}>;

function economyFailureCopy(code: EconomyTransactionErrorCode): string {
  if (code === 'insufficient_funds') {
    return 'Không đủ xu để hoàn tất giao dịch.';
  }
  if (code === 'inventory_full') {
    return 'Túi đồ không còn đủ chỗ.';
  }
  if (code === 'offer_locked') {
    return 'Mặt hàng này chưa được mở khóa.';
  }
  if (code === 'item_not_owned') {
    return 'Bạn không có đủ vật phẩm để bán.';
  }
  if (code === 'item_not_sellable') {
    return 'Vật phẩm này không thể bán.';
  }

  return 'Giao dịch không thể hoàn tất.';
}

export function mountGameExperience(
  appRoot: HTMLElement,
): GameExperienceController {
  const economyCatalog = createEconomyCatalogPort(gameContentCatalog);
  let economy = createInitialEconomyState(gameContentCatalog);
  const currentDay = 1;

  const hud = mountGameHud(
    appRoot,
    {
      day: currentDay,
      weatherLabel: 'Nắng đẹp',
      coins: economy.wallet.coins,
      energy: 84,
      energyMax: 100,
    },
    {
      onSelectToolbarSlot: (slotIndex) => {
        const result = selectToolbarSlot(economy.playerItems, slotIndex);
        if (result.ok) {
          economy = createEconomyState(economy.wallet, result.state);
          refresh();
        }
      },
      onBindInventoryItem: (itemId) => {
        const result = bindToolbarItem(
          economy.playerItems,
          economy.playerItems.toolbar.selectedSlotIndex,
          itemId,
        );
        if (result.ok) {
          economy = createEconomyState(economy.wallet, result.state);
          refresh();
        }
      },
    },
  );

  const shop = mountShopUi(hud.root, {
    onBeforeOpen: hud.closeInventory,
    onBuyOffer: (offerId) => {
      const result = buyShopOffer(economy, economyCatalog, {
        offerId,
        purchaseCount: 1,
        currentDay,
      });
      if (!result.ok) {
        shop.showFeedback(economyFailureCopy(result.error.code), 'error');
        return;
      }

      const event = result.events[0];
      if (event.type !== 'item-bought') {
        throw new Error('Buy transaction returned a non-buy event.');
      }

      economy = result.state;
      refresh();
      const item = gameContentCatalog.requireItem(event.itemId);
      shop.showFeedback(
        `Đã mua ${resolveVietnameseItemLabel(item.id, item.displayName)} · -${String(event.cost)} xu`,
        'success',
      );
    },
    onSellItem: (itemId) => {
      const result = sellInventoryItem(economy, economyCatalog, {
        itemId,
        quantity: 1,
      });
      if (!result.ok) {
        shop.showFeedback(economyFailureCopy(result.error.code), 'error');
        return;
      }

      const event = result.events[0];
      if (event.type !== 'item-sold') {
        throw new Error('Sell transaction returned a non-sell event.');
      }

      economy = result.state;
      refresh();
      const item = gameContentCatalog.requireItem(event.itemId);
      shop.showFeedback(
        `Đã bán ${resolveVietnameseItemLabel(item.id, item.displayName)} · +${String(event.revenue)} xu`,
        'success',
      );
    },
  });

  function refresh(): void {
    hud.renderPlayerItems(
      presentPlayerItems(
        economy.playerItems,
        gameContentCatalog,
        resolveVietnameseItemLabel,
      ),
    );
    shop.render(
      presentShop(
        economy,
        economyCatalog,
        currentDay,
        resolveVietnameseItemLabel,
      ),
    );
  }

  refresh();

  return Object.freeze({
    hud,
    getEconomyState: () => economy,
    getPlayerItemsState: () => economy.playerItems,
  });
}
