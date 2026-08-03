import { createEconomyCatalogPort } from '../application/economy/createEconomyCatalogPort.js';
import { presentShop } from '../application/economy/shopPresenter.js';
import {
  FarmLoopCoordinator,
  type FarmLoopExternalAction,
  type FarmLoopResult,
  type FarmLoopTutorialAction,
} from '../application/farmLoop/farmLoopCoordinator.js';
import { presentFarmLoop } from '../application/farmLoop/farmLoopPresenter.js';
import { FarmLoopSaveRepository } from '../application/farmLoop/farmLoopSaveRepository.js';
import {
  createInitialFarmLoopState,
  replaceFarmLoopEconomy,
  replaceFarmLoopPlayerItems,
  type FarmLoopState,
} from '../application/farmLoop/farmLoopState.js';
import { createFarmingContentPort } from '../application/farming/createFarmingContentPort.js';
import { createFarmingInventoryPort } from '../application/inventory/createFarmingInventoryPort.js';
import { presentPlayerItems } from '../application/inventory/playerItemsPresenter.js';
import { buildInfo } from '../build/buildInfo.js';
import { gameContentCatalog } from '../data/content/index.js';
import {
  buyShopOffer,
  sellInventoryItem,
  type EconomyTransactionErrorCode,
} from '../domain/economy/economyState.js';
import {
  bindToolbarItem,
  selectToolbarSlot,
  type PlayerItemsState,
} from '../domain/inventory/playerItemsState.js';
import { IndexedDbSaveStorage } from '../infrastructure/save/indexedDbSaveStorage.js';
import {
  mountFarmLoopUi,
  type FarmLoopUiController,
} from './farmLoopUi.js';
import {
  mountGameHud,
  type GameHudController,
} from './gameHud.js';
import { resolveVietnameseItemLabel } from './itemLabelsVi.js';
import { mountShopUi, type ShopUiController } from './shopUi.js';

const FARM_LOOP_SAVE_DATABASE_NAME = 'hh-farm-loop-save';

type UiReferences = {
  farmLoop?: FarmLoopUiController;
  shop?: ShopUiController;
};

export type GameExperienceController = Readonly<{
  hud: GameHudController;
  getFarmLoopState: () => FarmLoopState;
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

function describeLoadFailure(
  status: 'unavailable' | 'unrecoverable',
  detail: string,
): string {
  return status === 'unavailable'
    ? `Không thể mở autosave: ${detail}`
    : `Không thể phục hồi autosave: ${detail}`;
}

function createSaveStorage(): IndexedDbSaveStorage {
  const factory = typeof indexedDB === 'undefined' ? null : indexedDB;
  return new IndexedDbSaveStorage(factory, FARM_LOOP_SAVE_DATABASE_NAME);
}

export async function mountGameExperience(
  appRoot: HTMLElement,
): Promise<GameExperienceController> {
  const economyCatalog = createEconomyCatalogPort(gameContentCatalog);
  const farmingContent = createFarmingContentPort(gameContentCatalog);
  const farmingInventory = createFarmingInventoryPort();
  const saveRepository = new FarmLoopSaveRepository(
    createSaveStorage(),
    buildInfo.appVersion,
  );
  const loadResult = await saveRepository.load();

  let initialState = createInitialFarmLoopState(gameContentCatalog);
  let loadMessage: string | undefined;
  if (loadResult.status === 'loaded' || loadResult.status === 'recovered') {
    initialState = loadResult.state;
  } else if (loadResult.status === 'unavailable') {
    loadMessage = describeLoadFailure('unavailable', loadResult.error);
  } else if (loadResult.status === 'unrecoverable') {
    loadMessage = describeLoadFailure(
      'unrecoverable',
      `${loadResult.currentError} ${loadResult.previousError}`,
    );
  }

  const ui: UiReferences = {};
  let refresh = (): void => undefined;

  const coordinator = new FarmLoopCoordinator(
    initialState,
    farmingContent,
    farmingInventory,
    economyCatalog,
    Object.freeze({
      save: async (candidate) => {
        await saveRepository.save(candidate);
      },
    }),
    Object.freeze({
      present: (result: FarmLoopResult) => {
        refresh();
        ui.farmLoop?.presentResult(result);
      },
    }),
  );

  const commitPlayerItems = async (
    action: Extract<FarmLoopExternalAction, 'bind_toolbar' | 'select_toolbar'>,
    playerItems: PlayerItemsState,
  ): Promise<FarmLoopResult> => {
    const candidate = replaceFarmLoopPlayerItems(
      coordinator.getState(),
      playerItems,
    );
    return coordinator.commitExternal(action, candidate);
  };

  const hud = mountGameHud(
    appRoot,
    {
      day: initialState.farm.day,
      weatherLabel: 'Nắng đẹp',
      coins: initialState.economy.wallet.coins,
      energy: 84,
      energyMax: 100,
    },
    {
      onSelectToolbarSlot: (slotIndex) => {
        const current = coordinator.getState();
        const result = selectToolbarSlot(
          current.economy.playerItems,
          slotIndex,
        );
        if (result.ok) {
          void commitPlayerItems('select_toolbar', result.state);
        }
      },
      onBindInventoryItem: (itemId) => {
        const current = coordinator.getState();
        const result = bindToolbarItem(
          current.economy.playerItems,
          current.economy.playerItems.toolbar.selectedSlotIndex,
          itemId,
        );
        if (result.ok) {
          void commitPlayerItems('bind_toolbar', result.state);
        }
      },
    },
  );

  const handleShopCommit = async (
    action: Extract<FarmLoopExternalAction, 'shop_buy' | 'shop_sell'>,
    candidate: FarmLoopState,
    events: Parameters<FarmLoopCoordinator['commitExternal']>[2],
  ): Promise<FarmLoopResult> => coordinator.commitExternal(action, candidate, events);

  ui.shop = mountShopUi(hud.root, {
    onBeforeOpen: hud.closeInventory,
    onBuyOffer: (offerId) => {
      void (async () => {
        const current = coordinator.getState();
        const transaction = buyShopOffer(current.economy, economyCatalog, {
          offerId,
          purchaseCount: 1,
          currentDay: current.farm.day,
        });
        if (!transaction.ok) {
          ui.shop?.showFeedback(
            economyFailureCopy(transaction.error.code),
            'error',
          );
          return;
        }

        const event = transaction.events[0];
        if (event.type !== 'item-bought') {
          throw new Error('Buy transaction returned a non-buy event.');
        }

        const commit = await handleShopCommit(
          'shop_buy',
          replaceFarmLoopEconomy(current, transaction.state),
          transaction.events,
        );
        if (commit.status !== 'completed') {
          ui.shop?.showFeedback(commit.message, 'error');
          return;
        }

        const item = gameContentCatalog.requireItem(event.itemId);
        ui.shop?.showFeedback(
          `Đã mua ${resolveVietnameseItemLabel(item.id, item.displayName)} · -${String(event.cost)} xu`,
          'success',
        );
      })();
    },
    onSellItem: (itemId) => {
      void (async () => {
        const current = coordinator.getState();
        const transaction = sellInventoryItem(current.economy, economyCatalog, {
          itemId,
          quantity: 1,
        });
        if (!transaction.ok) {
          ui.shop?.showFeedback(
            economyFailureCopy(transaction.error.code),
            'error',
          );
          return;
        }

        const event = transaction.events[0];
        if (event.type !== 'item-sold') {
          throw new Error('Sell transaction returned a non-sell event.');
        }

        const commit = await handleShopCommit(
          'shop_sell',
          replaceFarmLoopEconomy(current, transaction.state),
          transaction.events,
        );
        if (commit.status !== 'completed') {
          ui.shop?.showFeedback(commit.message, 'error');
          return;
        }

        const item = gameContentCatalog.requireItem(event.itemId);
        ui.shop?.showFeedback(
          `Đã bán ${resolveVietnameseItemLabel(item.id, item.displayName)} · +${String(event.revenue)} xu`,
          'success',
        );
      })();
    },
  });

  ui.farmLoop = mountFarmLoopUi(hud.root, {
    onAction: async (action: FarmLoopTutorialAction) => {
      ui.farmLoop?.setBusy(true);
      try {
        await coordinator.perform(action);
      } finally {
        ui.farmLoop?.setBusy(false);
      }
    },
  });

  refresh = (): void => {
    const state = coordinator.getState();
    hud.setDay(state.farm.day);
    hud.renderPlayerItems(
      presentPlayerItems(
        state.economy.playerItems,
        gameContentCatalog,
        resolveVietnameseItemLabel,
      ),
    );
    ui.shop?.render(
      presentShop(
        state.economy,
        economyCatalog,
        state.farm.day,
        resolveVietnameseItemLabel,
      ),
    );
    ui.farmLoop?.render(presentFarmLoop(state, farmingContent));
  };

  refresh();
  ui.farmLoop.presentLoadStatus(loadResult.status, loadMessage);

  return Object.freeze({
    hud,
    getFarmLoopState: () => coordinator.getState(),
    getPlayerItemsState: () => coordinator.getState().economy.playerItems,
  });
}
