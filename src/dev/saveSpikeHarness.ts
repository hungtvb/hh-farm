import { FarmSaveRepository } from '../application/save/farmSaveRepository';
import type { FarmSavePayload } from '../domain/save/farmSave';
import { IndexedDbSaveStorage } from '../infrastructure/save/indexedDbSaveStorage';
import { writeRawSaveSlotForDiagnostics } from './indexedDbSaveDiagnostics';

const GAME_VERSION = '0.1.0';
const FIXED_SAVED_AT = '2026-08-02T12:00:00.000Z';

type SaveSpikeAction =
  | 'load'
  | 'reset'
  | 'save'
  | 'seed-recovery'
  | 'seed-v1'
  | 'unavailable';

function readAction(params: URLSearchParams): SaveSpikeAction {
  const action = params.get('save-spike');

  if (
    action === 'load' ||
    action === 'reset' ||
    action === 'save' ||
    action === 'seed-recovery' ||
    action === 'seed-v1' ||
    action === 'unavailable'
  ) {
    return action;
  }

  return 'load';
}

function readNumber(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const rawValue = params.get(key);

  if (rawValue === null) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function readInteger(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const value = readNumber(params, key, fallback);
  return Number.isInteger(value) ? value : fallback;
}

function createPayload(params: URLSearchParams): FarmSavePayload {
  const requestedFarmName = params.get('farmName')?.trim();
  const farmName =
    requestedFarmName === undefined || requestedFarmName.length === 0
      ? 'Browser Restart Farm'
      : requestedFarmName;

  return {
    farm: {
      farmName,
      day: readInteger(params, 'day', 7),
      coins: readInteger(params, 'coins', 1_250),
    },
    player: {
      x: readNumber(params, 'x', 352),
      y: readNumber(params, 'y', 224),
    },
  };
}

function createRepository(storage: IndexedDbSaveStorage): FarmSaveRepository {
  return new FarmSaveRepository(storage, {
    gameVersion: GAME_VERSION,
    now: () => new Date(FIXED_SAVED_AT),
  });
}

function renderResult(action: SaveSpikeAction, result: unknown): void {
  const root = document.querySelector<HTMLElement>('#game-root');

  if (root === null) {
    throw new Error('Save spike requires #game-root.');
  }

  root.replaceChildren();
  root.className = 'save-spike';

  const title = document.createElement('h1');
  title.textContent = 'HH Farm · IndexedDB save spike';

  const summary = document.createElement('p');
  summary.textContent = `Action: ${action}`;

  const output = document.createElement('pre');
  const status =
    typeof result === 'object' && result !== null && 'status' in result
      ? String(result.status)
      : action;
  output.id = 'save-spike-result';
  output.dataset.status = status;
  output.dataset.action = action;
  output.textContent = JSON.stringify(result, null, 2);

  root.append(title, summary, output);
  document.documentElement.dataset.saveSpike = 'active';
}

export async function runSaveSpikeHarness(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const action = readAction(params);
  const storage = new IndexedDbSaveStorage();
  const repository = createRepository(storage);

  try {
    switch (action) {
      case 'reset': {
        await repository.clear();
        renderResult(action, { status: 'reset' });
        return;
      }
      case 'save': {
        const envelope = await repository.save(createPayload(params));
        renderResult(action, { status: 'saved', envelope });
        return;
      }
      case 'seed-recovery': {
        await repository.clear();
        await repository.save({
          farm: { farmName: 'Known Good Farm', day: 4, coins: 800 },
          player: { x: 160, y: 192 },
        });
        await repository.save({
          farm: { farmName: 'Newest Farm', day: 5, coins: 950 },
          player: { x: 192, y: 224 },
        });
        await writeRawSaveSlotForDiagnostics('current', {
          schemaVersion: 2,
          payload: 'corrupted-current',
        });
        renderResult(action, await repository.load());
        return;
      }
      case 'seed-v1': {
        await repository.clear();
        await writeRawSaveSlotForDiagnostics('current', {
          schemaVersion: 1,
          gameVersion: '0.0.9',
          savedAt: '2026-07-30T08:30:00.000Z',
          payload: {
            farmName: 'Legacy Farm',
            day: 3,
            coins: 640,
            playerX: 128,
            playerY: 256,
          },
        });
        renderResult(action, await repository.load());
        return;
      }
      case 'unavailable': {
        const unavailableRepository = createRepository(
          new IndexedDbSaveStorage(null),
        );
        renderResult(action, await unavailableRepository.load());
        return;
      }
      case 'load': {
        renderResult(action, await repository.load());
      }
    }
  } catch (error) {
    renderResult(action, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
