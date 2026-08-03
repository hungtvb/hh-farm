import { describe, expect, it } from 'vitest';
import {
  createWorldInteractionIntent,
  resolveWorldInteractionApproach,
} from '../../src/domain/world/worldInteractionIntent.js';
import type { WorldInteractionTarget } from '../../src/domain/world/worldInteractionTarget.js';

const farmTile: WorldInteractionTarget = Object.freeze({
  id: 'starter-plot:-1:0',
  kind: 'farm_tile',
  x: 416,
  y: 352,
});

const bed: WorldInteractionTarget = Object.freeze({
  id: 'world:bed',
  kind: 'bed',
  x: 672,
  y: 448,
});

describe('world interaction intent', () => {
  it('approaches a farm tile from the nearest cardinal side', () => {
    expect(
      resolveWorldInteractionApproach(
        { x: 480, y: 448, facing: 'down' },
        farmTile,
      ),
    ).toEqual({ x: 416, y: 404, facing: 'up' });
  });

  it('approaches a bottom-anchored world object from the nearest side', () => {
    expect(
      resolveWorldInteractionApproach(
        { x: 480, y: 448, facing: 'right' },
        bed,
      ),
    ).toEqual({ x: 604, y: 448, facing: 'right' });
  });

  it('uses a stable candidate order when multiple approach points tie', () => {
    expect(
      resolveWorldInteractionApproach(
        { x: 100, y: 100, facing: 'down' },
        { id: 'farm:center', kind: 'farm_tile', x: 100, y: 100 },
      ),
    ).toEqual({ x: 100, y: 152, facing: 'up' });
  });

  it('creates an immutable action intent for the tapped target', () => {
    expect(
      createWorldInteractionIntent(
        { x: 480, y: 448, facing: 'down' },
        farmTile,
        'till',
      ),
    ).toEqual({
      action: 'till',
      target: farmTile,
      approach: { x: 416, y: 404, facing: 'up' },
    });
  });
});
