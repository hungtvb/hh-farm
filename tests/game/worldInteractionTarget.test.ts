import { describe, expect, it } from 'vitest';
import {
  requiredInteractionKind,
  resolveWorldInteractionTarget,
  type WorldInteractionTarget,
} from '../../src/game/world/worldInteractionTarget.js';

const targets: readonly WorldInteractionTarget[] = Object.freeze([
  Object.freeze({ id: 'farm:near', kind: 'farm_tile', x: 100, y: 40 }),
  Object.freeze({ id: 'bed', kind: 'bed', x: 100, y: 0 }),
  Object.freeze({ id: 'shipping-bin', kind: 'shipping_bin', x: 40, y: 100 }),
]);

describe('world interaction targeting', () => {
  it('selects the nearest candidate inside the actor facing lane', () => {
    expect(
      resolveWorldInteractionTarget(
        { x: 100, y: 100, facing: 'up' },
        targets,
      ),
    ).toMatchObject({ id: 'farm:near', kind: 'farm_tile' });

    expect(
      resolveWorldInteractionTarget(
        { x: 100, y: 70, facing: 'up' },
        targets,
      ),
    ).toMatchObject({ id: 'farm:near' });
  });

  it('rejects candidates behind, outside the lane or beyond range', () => {
    expect(
      resolveWorldInteractionTarget(
        { x: 100, y: 100, facing: 'down' },
        targets,
      ),
    ).toBeUndefined();
    expect(
      resolveWorldInteractionTarget(
        { x: 180, y: 100, facing: 'left' },
        targets,
        { maxDistance: 60, forwardTolerance: 24 },
      ),
    ).toBeUndefined();
  });

  it('uses stable target IDs to break equal-distance ties', () => {
    const equalTargets: readonly WorldInteractionTarget[] = Object.freeze([
      Object.freeze({ id: 'target:b', kind: 'bed', x: 90, y: 50 }),
      Object.freeze({ id: 'target:a', kind: 'shipping_bin', x: 110, y: 50 }),
    ]);

    expect(
      resolveWorldInteractionTarget(
        { x: 100, y: 100, facing: 'up' },
        equalTargets,
        { maxDistance: 80, forwardTolerance: 20 },
      )?.id,
    ).toBe('target:a');
  });

  it('routes tutorial actions to intentional world target kinds', () => {
    expect(requiredInteractionKind('till')).toBe('farm_tile');
    expect(requiredInteractionKind('plant')).toBe('farm_tile');
    expect(requiredInteractionKind('water')).toBe('farm_tile');
    expect(requiredInteractionKind('harvest')).toBe('farm_tile');
    expect(requiredInteractionKind('next_day')).toBe('bed');
    expect(requiredInteractionKind('sell')).toBe('shipping_bin');
    expect(requiredInteractionKind('skip_tutorial')).toBeUndefined();
  });
});
