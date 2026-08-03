import { createHudDayPresentationPort } from '../application/day/createHudDayPresentationPort.js';
import { createNextDayCriticalSavePort } from '../application/day/createNextDayCriticalSavePort.js';
import { RequestNextDayCoordinator } from '../application/day/requestNextDayCoordinator.js';
import { createFarmingContentPort } from '../application/farming/createFarmingContentPort.js';
import { FarmSaveRepository } from '../application/save/farmSaveRepository.js';
import { gameContentCatalog } from '../data/content/index.js';
import type { DayTransitionState } from '../domain/day/dayTransition.js';
import { IndexedDbSaveStorage } from '../infrastructure/save/indexedDbSaveStorage.js';
import type { GameHudController } from '../ui/gameHud.js';
import { createDayTransitionFixture } from './dayTransitionFixture.js';

const GAME_VERSION = '0.1.0-day-spike';
const FIXED_TIME = '2026-08-03T01:30:00.000Z';

type Action = 'load' | 'reset' | 'run';

function readAction(): Action {
  const value = new URLSearchParams(window.location.search).get('day-spike');
  return value === 'reset' || value === 'run' ? value : 'load';
}

function createRepository(): FarmSaveRepository {
  return new FarmSaveRepository(new IndexedDbSaveStorage(), {
    gameVersion: GAME_VERSION,
    now: () => new Date(FIXED_TIME),
  });
}

function render(action: Action, value: unknown): void {
  const root = document.querySelector<HTMLElement>('#game-root');
  if (root === null) {
    throw new Error('Day transition test requires #game-root.');
  }

  root.replaceChildren();
  root.className = 'save-spike';
  const title = document.createElement('h1');
  title.textContent = 'HH Farm · Day transition test';
  const output = document.createElement('pre');
  output.id = 'day-transition-result';
  output.dataset.action = action;
  output.textContent = JSON.stringify(value, null, 2);
  root.append(title, output);
  document.documentElement.dataset.dayTransitionHarness = 'active';
}

export async function runDayTransitionHarness(
  hud: GameHudController,
): Promise<void> {
  const action = readAction();
  const repository = createRepository();

  if (action === 'reset') {
    await repository.clear();
    render(action, { status: 'reset' });
    return;
  }

  if (action === 'load') {
    const loaded = await repository.load();
    if (loaded.status === 'loaded' || loaded.status === 'recovered') {
      hud.setDay(loaded.envelope.payload.farm.day);
    }
    render(action, loaded);
    return;
  }

  await repository.clear();
  let current = createDayTransitionFixture();
  const calls: string[] = [];
  const save = createNextDayCriticalSavePort(repository, () => ({
    x: 320,
    y: 192,
  }));
  const presentation = createHudDayPresentationPort(hud);
  const coordinator = new RequestNextDayCoordinator(
    createFarmingContentPort(gameContentCatalog),
    Object.freeze({
      read: () => current,
      commit: (state: DayTransitionState) => {
        calls.push(`commit:${String(state.farm.day)}`);
        current = state;
      },
    }),
    Object.freeze({
      flush: async (candidate: DayTransitionState) => {
        calls.push(`save:start:${String(candidate.farm.day)}`);
        await save.flush(candidate);
        calls.push(`save:end:${String(candidate.farm.day)}`);
      },
    }),
    Object.freeze({
      present: async (previous, next, events) => {
        calls.push(`present:${String(next.farm.day)}`);
        await presentation.present(previous, next, events);
      },
    }),
  );

  const firstRequest = coordinator.requestNextDay();
  const secondResult = await coordinator.requestNextDay();
  const firstResult = await firstRequest;
  const loaded = await repository.load();

  render(action, {
    status: 'completed',
    firstResult,
    secondResult,
    calls,
    current,
    loaded,
  });
}
