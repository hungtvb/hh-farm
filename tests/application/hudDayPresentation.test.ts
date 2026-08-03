import { describe, expect, it, vi } from 'vitest';
import { createHudDayPresentationPort } from '../../src/application/day/createHudDayPresentationPort.js';
import { createInitialFarmState } from '../../src/domain/farm/farmState.js';
import { createFarmField } from '../../src/domain/farming/farmTileState.js';
import type { DayTransitionState } from '../../src/domain/day/dayTransition.js';

function createState(day: number): DayTransitionState {
  return Object.freeze({
    farm: Object.freeze({ ...createInitialFarmState(), day }),
    field: createFarmField([]),
  });
}

describe('createHudDayPresentationPort', () => {
  it('updates the committed day and marks transition completion', async () => {
    const setDay = vi.fn();
    const markDayTransitionComplete = vi.fn();
    const port = createHudDayPresentationPort({
      setDay,
      markDayTransitionComplete,
    });

    await port.present(createState(1), createState(2), [
      { type: 'farm-day-advanced', previousDay: 1, day: 2 },
    ]);

    expect(setDay).toHaveBeenCalledWith(2);
    expect(markDayTransitionComplete).toHaveBeenCalledWith(1);
  });
});
