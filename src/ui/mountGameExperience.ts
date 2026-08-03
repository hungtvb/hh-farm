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
import {
  createTranslator,
  localeForLanguage,
  resolveItemLabel,
  type Translator,
} from '../application/i18n/gameTranslator.js';
import { createFarmingInventoryPort } from '../application/inventory/createFarmingInventoryPort.js';
import { presentPlayerItems } from '../application/inventory/playerItemsPresenter.js';
import {
  SettingsRepository,
  type SettingsStorage,
} from '../application/settings/settingsRepository.js';
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
import {
  isSeedItemUnlocked,
  requiredLevelForSeedItem,
} from '../domain/progression/progressionState.js';
import type { PlayerSettings } from '../domain/settings/playerSettings.js';
import { IndexedDbSaveStorage } from '../infrastructure/save/indexedDbSaveStorage.js';
import { LocalStorageSettingsStorage } from '../infrastructure/settings/localStorageSettingsStorage.js';
import {
  applyPlayerSettingsToDocument,
  vibrateForCommittedAction,
} from './applyPlayerSettings.js';
import {
  mountFarmLoopUi,
  type FarmLoopUiController,
} from './farmLoopUi.js';
import {
  mountGameHud,
  type GameHudController,
} from './gameHud.js';
import { localizeGameHud } from './localizeGameHud.js';
import { mountSettingsUi, type SettingsUiController } from './settingsUi.js';
import { mountShopUi, type ShopUiController } from './shopUi.js';

const FARM_LOOP_SAVE_DATABASE_NAME = 'hh-farm-loop-save';

type UiReferences = {
  farmLoop?: FarmLoopUiController;
  settings?: SettingsUiController;
  shop?: ShopUiController;
};

export type GameExperienceController = Readonly<{
  hud: GameHudController;
  getFarmLoopState: () => FarmLoopState;
  getPlayerItemsState: () => PlayerItemsState;
}>;

function economyFailureCopy(
  code: EconomyTransactionErrorCode,
  translate: Translator,
): string {
  if (code === 'insufficient_funds') {
    return translate('shop.disabled.insufficient_funds');
  }
  if (code === 'inventory_full') {
    return translate('failure.inventory_full');
  }
  if (code === 'offer_locked') {
    return translate('shop.disabled.offer_locked');
  }
  if (code === 'item_not_owned') {
    return translate('failure.item_not_owned');
  }
  if (code === 'item_not_sellable') {
    return translate('failure.item_not_sellable');
  }

  return translate('failure.transaction_failed');
}

function describeLoadFailure(
  status: 'unavailable' | 'unrecoverable',
  detail: string,
  translate: Translator,
): string {
  return status === 'unavailable'
    ? translate('load.unavailable', { detail })
    : translate('load.unrecoverable', { detail });
}

function createSaveStorage(): IndexedDbSaveStorage {
  const factory = typeof indexedDB === 'undefined' ? null : indexedDB;
  return new IndexedDbSaveStorage(factory, FARM_LOOP_SAVE_DATABASE_NAME);
}

function createUnavailableSettingsStorage(error: unknown): SettingsStorage {
  const message = error instanceof Error ? error.message : String(error);
  return Object.freeze({
    read: () => {
      throw new Error(message);
    },
    write: () => {
      throw new Error(message);
    },
    remove: () => {
      throw new Error(message);
    },
  });
}

function createSettingsRepository(): SettingsRepository {
  try {
    return new SettingsRepository(
      new LocalStorageSettingsStorage(window.localStorage),
    );
  } catch (error) {
    return new SettingsRepository(createUnavailableSettingsStorage(error));
  }
}

function progressionLockCopy(
  itemId: string,
  translate: Translator,
): string {
  return translate('shop.disabled.progression_locked', {
    level: requiredLevelForSeedItem(itemId) ?? 1,
  });
}

export async function mountGameExperience(
  appRoot: HTMLElement,
): Promise<GameExperienceController> {
  const settingsRepository = createSettingsRepository();
  const settingsLoad = settingsRepository.load();
  let activeSettings: PlayerSettings = settingsLoad.settings;
  applyPlayerSettingsToDocument(activeSettings);

  const translate = createTranslator(activeSettings.language);
  const locale = localeForLanguage(activeSettings.language);
  const resolveLabel = (itemId: string, sourceName: string): string =>
    resolveItemLabel(activeSettings.language, itemId, sourceName);

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
    loadMessage = describeLoadFailure(
      'unavailable',
      loadResult.error,
      translate,
    );
  } else if (loadResult.status === 'unrecoverable') {
    loadMessage = describeLoadFailure(
      'unrecoverable',
      `${loadResult.currentError} ${loadResult.previousError}`,
      translate,
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
        if (result.status === 'completed') {
          vibrateForCommittedAction(activeSettings);
        }
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
      weatherLabel: translate('app.weatherSunny'),
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
  localizeGameHud(hud.root, translate);

  const handleShopCommit = async (
    action: Extract<FarmLoopExternalAction, 'shop_buy' | 'shop_sell'>,
    candidate: FarmLoopState,
    events: Parameters<FarmLoopCoordinator['commitExternal']>[2],
  ): Promise<FarmLoopResult> => coordinator.commitExternal(action, candidate, events);

  ui.shop = mountShopUi(
    hud.root,
    {
      onBeforeOpen: () => {
        hud.closeInventory();
        ui.settings?.close();
      },
      onBuyOffer: (offerId) => {
        void (async () => {
          const current = coordinator.getState();
          const offer = economyCatalog
            .listShopOffers()
            .find((candidate) => candidate.id === offerId);
          if (offer === undefined) {
            ui.shop?.showFeedback(
              translate('failure.transaction_failed'),
              'error',
            );
            return;
          }
          if (!isSeedItemUnlocked(current.progression, offer.itemId)) {
            ui.shop?.showFeedback(
              progressionLockCopy(offer.itemId, translate),
              'error',
            );
            return;
          }

          const transaction = buyShopOffer(current.economy, economyCatalog, {
            offerId,
            purchaseCount: 1,
            currentDay: current.farm.day,
          });
          if (!transaction.ok) {
            ui.shop?.showFeedback(
              economyFailureCopy(transaction.error.code, translate),
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
            translate('shop.feedback.bought', {
              item: resolveLabel(item.id, item.displayName),
              coins: event.cost,
            }),
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
              economyFailureCopy(transaction.error.code, translate),
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
            translate('shop.feedback.sold', {
              item: resolveLabel(item.id, item.displayName),
              coins: event.revenue,
            }),
            'success',
          );
        })();
      },
    },
    translate,
    locale,
  );

  ui.farmLoop = mountFarmLoopUi(
    hud.root,
    {
      onAction: async (action: FarmLoopTutorialAction) => {
        ui.farmLoop?.setBusy(true);
        try {
          await coordinator.perform(action);
        } finally {
          ui.farmLoop?.setBusy(false);
        }
      },
    },
    translate,
    locale,
  );

  ui.settings = mountSettingsUi(
    hud.root,
    activeSettings,
    translate,
    {
      onBeforeOpen: () => {
        hud.closeInventory();
        ui.shop?.close();
      },
      onSave: async (nextSettings) => {
        try {
          await settingsRepository.save(nextSettings);
        } catch (error) {
          return Object.freeze({
            status: 'error' as const,
            message: error instanceof Error ? error.message : String(error),
          });
        }

        const reloadRequired =
          nextSettings.language !== activeSettings.language;
        activeSettings = nextSettings;
        applyPlayerSettingsToDocument(activeSettings);
        if (reloadRequired) {
          window.setTimeout(() => window.location.reload(), 80);
        }
        return Object.freeze({ status: 'saved' as const, reloadRequired });
      },
    },
  );

  refresh = (): void => {
    const state = coordinator.getState();
    hud.setDay(state.farm.day);
    hud.renderPlayerItems(
      presentPlayerItems(
        state.economy.playerItems,
        gameContentCatalog,
        resolveLabel,
      ),
    );
    localizeGameHud(hud.root, translate);
    ui.shop?.render(
      presentShop(
        state.economy,
        economyCatalog,
        state.farm.day,
        resolveLabel,
        state.progression,
      ),
    );
    ui.farmLoop?.render(presentFarmLoop(state, farmingContent, translate));
    ui.settings?.renderProgression(state.progression);
  };

  refresh();
  const migrated =
    (loadResult.status === 'loaded' || loadResult.status === 'recovered') &&
    loadResult.migratedFrom === 1;
  ui.farmLoop.presentLoadStatus(loadResult.status, loadMessage, migrated);
  ui.settings.presentLoadStatus(settingsLoad);

  return Object.freeze({
    hud,
    getFarmLoopState: () => coordinator.getState(),
    getPlayerItemsState: () => coordinator.getState().economy.playerItems,
  });
}
