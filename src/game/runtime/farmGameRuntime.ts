import type {
  FarmLoopResult,
  FarmLoopTutorialAction,
} from '../../application/farmLoop/farmLoopCoordinator.js';
import type { FarmLoopState } from '../../application/farmLoop/farmLoopState.js';

export const FARM_GAME_RUNTIME_REGISTRY_KEY = 'hh-farm-runtime';

export type FarmGameRuntime = Readonly<{
  getState: () => FarmLoopState;
  perform: (
    action: FarmLoopTutorialAction,
    targetTileId: string,
  ) => Promise<FarmLoopResult>;
}>;

function isFarmGameRuntime(value: unknown): value is FarmGameRuntime {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getState' in value &&
    typeof value.getState === 'function' &&
    'perform' in value &&
    typeof value.perform === 'function'
  );
}

export function requireFarmGameRuntime(value: unknown): FarmGameRuntime {
  if (!isFarmGameRuntime(value)) {
    throw new Error('Farm game runtime is unavailable.');
  }

  return value;
}
