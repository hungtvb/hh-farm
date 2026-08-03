import { describe, expect, it, vi } from 'vitest';
import {
  RequestNextDayCoordinator,
  type NextDayCriticalSavePort,
  type NextDayPresentationPort,
  type NextDayStatePort,
} from '../../src/application/day/requestNextDayCoordinator.js';
import { createInitialFarmState } from '../../src/domain/farm/farmState.js';
import { createFarmField } from '../../src/domain/farming/farmTileState.js';
import type { FarmingContentPort } from '../../src/domain/farming/farmingPorts.js';
import type { DayTransitionState } from '../../src/domain/day/dayTransition.js';

const contentPort: FarmingContentPort = Object.freeze({
  getCrop: () => undefined,
});

function createState(day = 1): DayTransitionState {
  return Object.freeze({
    farm: Object.freeze({
      ...createInitialFarmState(),
      day,
    }),
    field: createFarmField([]),
  });
}

function createDeferred(): Readonly<{
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}> {
  let resolvePromise: (() => void) | undefined;
  let rejectPromise: ((error: Error) => void) | undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return Object.freeze({
    promise,
    resolve: () => resolvePromise?.(),
    reject: (error: Error) => rejectPromise?.(error),
  });
}

describe('RequestNextDayCoordinator', () => {
  it('flushes the candidate before committing and blocks a concurrent request', async () => {
    let current = createState();
    const calls: string[] = [];
    const deferred = createDeferred();
    const statePort: NextDayStatePort = Object.freeze({
      read: () => current,
      commit: (state) => {
        calls.push(`commit:${String(state.farm.day)}`);
        current = state;
      },
    });
    const savePort: NextDayCriticalSavePort = Object.freeze({
      flush: async (candidate) => {
        calls.push(`save:start:${String(candidate.farm.day)}`);
        await deferred.promise;
        calls.push(`save:end:${String(candidate.farm.day)}`);
      },
    });
    const presentationPort: NextDayPresentationPort = Object.freeze({
      present: (_previous, next) => {
        calls.push(`present:${String(next.farm.day)}`);
      },
    });
    const coordinator = new RequestNextDayCoordinator(
      contentPort,
      statePort,
      savePort,
      presentationPort,
    );

    const first = coordinator.requestNextDay();
    await vi.waitFor(() => {
      expect(calls).toEqual(['save:start:2']);
    });

    await expect(coordinator.requestNextDay()).resolves.toEqual({
      status: 'transition_in_progress',
    });
    expect(current.farm.day).toBe(1);

    deferred.resolve();
    await expect(first).resolves.toMatchObject({
      status: 'completed',
      state: { farm: { day: 2 } },
    });
    expect(calls).toEqual([
      'save:start:2',
      'save:end:2',
      'commit:2',
      'present:2',
    ]);
    expect(current.farm.day).toBe(2);
  });

  it('does not commit when the critical save fails and unlocks for retry', async () => {
    let current = createState();
    let shouldFail = true;
    const commit = vi.fn((state: DayTransitionState) => {
      current = state;
    });
    const savePort: NextDayCriticalSavePort = Object.freeze({
      flush: async () => {
        if (shouldFail) {
          throw new Error('IndexedDB quota exceeded.');
        }
      },
    });
    const coordinator = new RequestNextDayCoordinator(
      contentPort,
      Object.freeze({ read: () => current, commit }),
      savePort,
      Object.freeze({ present: vi.fn() }),
    );

    await expect(coordinator.requestNextDay()).resolves.toEqual({
      status: 'save_failed',
      error: 'IndexedDB quota exceeded.',
    });
    expect(commit).not.toHaveBeenCalled();
    expect(current.farm.day).toBe(1);

    shouldFail = false;
    await expect(coordinator.requestNextDay()).resolves.toMatchObject({
      status: 'completed',
      state: { farm: { day: 2 } },
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('keeps the committed transition when presentation fails', async () => {
    let current = createState();
    const coordinator = new RequestNextDayCoordinator(
      contentPort,
      Object.freeze({
        read: () => current,
        commit: (state: DayTransitionState) => {
          current = state;
        },
      }),
      Object.freeze({ flush: vi.fn().mockResolvedValue(undefined) }),
      Object.freeze({
        present: () => {
          throw new Error('Transition overlay unavailable.');
        },
      }),
    );

    await expect(coordinator.requestNextDay()).resolves.toMatchObject({
      status: 'completed',
      state: { farm: { day: 2 } },
      presentationError: 'Transition overlay unavailable.',
    });
    expect(current.farm.day).toBe(2);
  });
});
