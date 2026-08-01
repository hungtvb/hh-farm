import { describe, expect, it } from 'vitest';
import {
  isMoving,
  resolveFacingDirection,
  resolveMovementVector,
} from '../../src/domain/player/movement';

describe('player movement', () => {
  it('cancels opposite input', () => {
    const movement = resolveMovementVector({
      left: true,
      right: true,
      up: true,
      down: true,
    });

    expect(movement).toEqual({ x: 0, y: 0 });
    expect(isMoving(movement)).toBe(false);
  });

  it('keeps cardinal input at unit length', () => {
    const movement = resolveMovementVector({
      left: false,
      right: true,
      up: false,
      down: false,
    });

    expect(movement).toEqual({ x: 1, y: 0 });
  });

  it('normalizes diagonal input', () => {
    const movement = resolveMovementVector({
      left: false,
      right: true,
      up: true,
      down: false,
    });

    expect(Math.hypot(movement.x, movement.y)).toBeCloseTo(1, 10);
  });

  it('retains facing while idle', () => {
    expect(resolveFacingDirection({ x: 0, y: 0 }, 'left')).toBe('left');
  });

  it('prioritizes vertical facing on a diagonal', () => {
    expect(resolveFacingDirection({ x: 1, y: -1 }, 'down')).toBe('up');
  });
});
