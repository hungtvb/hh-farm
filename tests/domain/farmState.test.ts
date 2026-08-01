import { describe, expect, it } from 'vitest';
import { advanceDay, createInitialFarmState } from '../../src/domain/farm/farmState';

describe('farm state', () => {
  it('creates deterministic starter state', () => {
    expect(createInitialFarmState()).toEqual({
      day: 1,
      coins: 250,
      farmName: 'HH Farm',
    });
  });

  it('normalizes a custom farm name', () => {
    expect(createInitialFarmState('  Green Leaf  ').farmName).toBe('Green Leaf');
  });

  it('rejects an empty farm name', () => {
    expect(() => createInitialFarmState('   ')).toThrow('Farm name must not be empty.');
  });

  it('advances the day without mutating the previous state', () => {
    const previous = createInitialFarmState();
    const next = advanceDay(previous);

    expect(previous.day).toBe(1);
    expect(next.day).toBe(2);
    expect(next).not.toBe(previous);
  });
});
