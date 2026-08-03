import {
  farmFailureCopy,
  farmSuccessCopy,
  type Translator,
} from '../application/i18n/gameTranslator.js';
import type {
  FarmLoopResult,
  FarmLoopTutorialAction,
} from '../application/farmLoop/farmLoopCoordinator.js';
import type { FarmLoopViewModel } from '../application/farmLoop/farmLoopPresenter.js';
import { getVisualAssetUrl } from './visualSystem.js';

export type FarmLoopUiActions = Readonly<{
  onAction: (action: FarmLoopTutorialAction) => Promise<void> | void;
}>;

export type FarmLoopUiController = Readonly<{
  root: HTMLElement;
  render: (view: FarmLoopViewModel) => void;
  presentResult: (result: FarmLoopResult) => void;
  setBusy: (busy: boolean) => void;
  presentLoadStatus: (
    status: 'empty' | 'loaded' | 'recovered' | 'unavailable' | 'unrecoverable',
    message?: string,
    migrated?: boolean,
  ) => void;
  destroy: () => void;
}>;

const TILE_ACTIONS: readonly FarmLoopTutorialAction[] = Object.freeze([
  'till',
  'plant',
  'water',
  'harvest',
]);

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  return element;
}

function actionEffect(action: FarmLoopResult['action']): string {
  if (action === 'water') {
    return 'water-sparkle';
  }
  if (action === 'harvest') {
    return 'harvest-burst';
  }
  if (action === 'next_day') {
    return 'day-flash';
  }
  if (action === 'shop_buy' || action === 'shop_sell' || action === 'sell') {
    return 'coin-burst';
  }
  return 'soil-puff';
}

function actionSfxCue(action: FarmLoopResult['action']): string {
  if (action === 'next_day') {
    return 'day-transition-placeholder';
  }
  if (action === 'sell' || action === 'shop_buy' || action === 'shop_sell') {
    return 'coin-placeholder';
  }
  return `${action}-placeholder`;
}

function progressionFeedback(
  result: Extract<FarmLoopResult, { status: 'completed' }>,
  translate: Translator,
): string | null {
  const unlock = result.events.find((event) => event.type === 'crop-unlocked');
  if (unlock?.type !== 'crop-unlocked') {
    return null;
  }
  return unlock.cropId === 'carrot'
    ? translate('progress.unlock.carrot')
    : translate('progress.unlock.strawberry');
}

function failureFeedback(
  result: Exclude<FarmLoopResult, { status: 'completed' }>,
  translate: Translator,
): string {
  if (result.code === 'save_failed') {
    const separatorIndex = result.message.indexOf(':');
    const detail =
      separatorIndex === -1
        ? result.message
        : result.message.slice(separatorIndex + 1).trim();
    return translate('failure.save_failed', { detail });
  }

  return farmFailureCopy(translate, result.code, result.message);
}

export function mountFarmLoopUi(
  hudRoot: HTMLElement,
  actions: FarmLoopUiActions,
  translate: Translator,
  locale: string,
): FarmLoopUiController {
  hudRoot.querySelector('.hh-farm-loop')?.remove();

  const root = createElement('section', 'hh-farm-loop');
  root.dataset.ready = 'true';
  root.setAttribute('aria-label', translate('farm.rootLabel'));

  const tutorial = createElement('aside', 'hh-farm-loop__tutorial');
  const eyebrow = createElement('span', 'hh-farm-loop__eyebrow');
  eyebrow.textContent = translate('farm.eyebrow');
  const objective = createElement('strong', 'hh-farm-loop__objective');
  const hint = createElement('span', 'hh-farm-loop__hint');
  const skipButton = createElement('button', 'hh-farm-loop__skip');
  skipButton.type = 'button';
  skipButton.textContent = translate('farm.skip');
  skipButton.dataset.action = 'skip_tutorial';
  tutorial.append(eyebrow, objective, hint, skipButton);

  const stage = createElement('div', 'hh-farm-loop__stage');
  const plot = createElement('div', 'hh-farm-loop__plot');
  plot.dataset.target = 'tutorial-plot';
  plot.setAttribute('aria-label', translate('farm.plotLabel'));
  const soil = createElement('span', 'hh-farm-loop__soil');
  const crop = createElement('span', 'hh-farm-loop__crop');
  const water = createElement('span', 'hh-farm-loop__water');
  water.setAttribute('aria-hidden', 'true');
  const highlight = createElement('span', 'hh-farm-loop__highlight');
  highlight.setAttribute('aria-hidden', 'true');
  const particles = createElement('span', 'hh-farm-loop__particles');
  particles.setAttribute('aria-hidden', 'true');
  plot.append(soil, crop, water, highlight, particles);

  const stats = createElement('div', 'hh-farm-loop__stats');
  const day = createElement('span', 'hh-farm-loop__stat');
  const seeds = createElement('span', 'hh-farm-loop__stat');
  const produce = createElement('span', 'hh-farm-loop__stat');
  const coins = createElement('span', 'hh-farm-loop__stat');
  stats.append(day, seeds, produce, coins);
  stage.append(plot, stats);

  const actionArea = createElement('div', 'hh-farm-loop__actions');
  const feedback = createElement('div', 'hh-farm-loop__feedback');
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.textContent = translate('farm.initialFeedback');
  const buttons = new Map<FarmLoopTutorialAction, HTMLButtonElement>();

  const perform = async (action: FarmLoopTutorialAction): Promise<void> => {
    await actions.onAction(action);
  };

  skipButton.addEventListener('click', () => {
    void perform('skip_tutorial');
  });

  root.append(tutorial, stage, actionArea, feedback);
  hudRoot.append(root);

  let particleTimer: number | undefined;

  const render = (view: FarmLoopViewModel): void => {
    root.dataset.day = String(view.day);
    root.dataset.tutorialStep = view.tutorialStep;
    root.dataset.tutorialSkipped = String(view.tutorialSkipped);
    root.dataset.tutorialComplete = String(view.tutorialComplete);
    root.dataset.soil = view.soil;
    root.dataset.watered = String(view.watered);
    root.dataset.cropStage =
      view.cropStageIndex === null ? '' : String(view.cropStageIndex);
    root.dataset.cropMature = String(view.cropMature);

    objective.textContent = view.objectiveTitle;
    hint.textContent = view.objectiveHint;
    skipButton.hidden = view.tutorialSkipped || view.tutorialComplete;

    soil.style.backgroundImage = `url("${getVisualAssetUrl(
      view.soil === 'tilled'
        ? view.watered
          ? 'soil-watered.svg'
          : 'soil-tilled.svg'
        : 'soil-untilled.svg',
    )}")`;
    crop.hidden = view.cropId === null;
    if (view.cropId !== null) {
      crop.style.backgroundImage = `url("${getVisualAssetUrl('crop-turnip.svg')}")`;
      crop.style.backgroundPosition = `${String(
        (view.cropStageIndex ?? 0) * (100 / 3),
      )}% 0`;
    }
    water.hidden = !view.watered;

    day.textContent = translate('common.day', { day: view.day });
    seeds.textContent = translate('farm.stat.seeds', {
      quantity: view.turnipSeeds,
    });
    produce.textContent = translate('farm.stat.produce', {
      quantity: view.turnipProduce,
    });
    coins.textContent = translate('farm.stat.coins', {
      coins: view.coins.toLocaleString(locale),
    });

    actionArea.replaceChildren();
    buttons.clear();
    for (const actionView of view.actions) {
      if (actionView.action === 'skip_tutorial') {
        continue;
      }

      const button = createElement('button', 'hh-farm-loop__action');
      button.type = 'button';
      button.dataset.action = actionView.action;
      button.dataset.recommended = String(actionView.recommended);
      button.textContent = actionView.label;
      button.setAttribute(
        'aria-label',
        actionView.recommended
          ? translate('farm.recommendedAria', { label: actionView.label })
          : actionView.label,
      );
      button.addEventListener('click', () => {
        void perform(actionView.action);
      });
      buttons.set(actionView.action, button);
      actionArea.append(button);
    }

    const recommendedTileAction = view.actions.some(
      (action) =>
        action.recommended && TILE_ACTIONS.includes(action.action),
    );
    plot.dataset.highlighted = String(recommendedTileAction);
  };

  const setBusy = (busy: boolean): void => {
    root.dataset.busy = String(busy);
    for (const button of buttons.values()) {
      button.disabled = busy;
    }
    skipButton.disabled = busy;
  };

  const presentResult = (result: FarmLoopResult): void => {
    if (result.status !== 'completed') {
      feedback.dataset.kind = 'error';
      feedback.textContent = failureFeedback(result, translate);
      root.dataset.lastResult = result.status;
      return;
    }

    const unlockCopy = progressionFeedback(result, translate);
    feedback.dataset.kind = 'success';
    feedback.textContent = unlockCopy ?? farmSuccessCopy(translate, result.action);
    root.dataset.lastResult = 'completed';
    root.dataset.lastAction = result.action;
    root.dataset.sfxCue = actionSfxCue(result.action);
    particles.dataset.effect = actionEffect(result.action);
    particles.dataset.active = 'true';

    if (particleTimer !== undefined) {
      window.clearTimeout(particleTimer);
    }
    particleTimer = window.setTimeout(() => {
      particles.dataset.active = 'false';
    }, 650);
  };

  const presentLoadStatus = (
    status: 'empty' | 'loaded' | 'recovered' | 'unavailable' | 'unrecoverable',
    message?: string,
    migrated = false,
  ): void => {
    root.dataset.loadStatus = status;
    root.dataset.saveMigrated = String(migrated);
    if (migrated) {
      feedback.dataset.kind = 'success';
      feedback.textContent = translate('farm.load.migrated');
    } else if (status === 'loaded') {
      feedback.dataset.kind = 'success';
      feedback.textContent = translate('farm.load.loaded');
    } else if (status === 'recovered') {
      feedback.dataset.kind = 'success';
      feedback.textContent = translate('farm.load.recovered');
    } else if (status === 'unavailable' || status === 'unrecoverable') {
      feedback.dataset.kind = 'error';
      feedback.textContent = message ?? translate('farm.load.failed');
    }
  };

  return Object.freeze({
    root,
    render,
    presentResult,
    setBusy,
    presentLoadStatus,
    destroy: () => {
      if (particleTimer !== undefined) {
        window.clearTimeout(particleTimer);
      }
      root.remove();
    },
  });
}
