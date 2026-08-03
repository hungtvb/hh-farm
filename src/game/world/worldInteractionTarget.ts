import type { FarmLoopTutorialAction } from '../../application/farmLoop/farmLoopCoordinator.js';
import type { FacingDirection } from '../../domain/player/movement.js';

export type WorldInteractionKind = 'bed' | 'farm_tile' | 'shipping_bin';

export type WorldInteractionTarget = Readonly<{
  id: string;
  kind: WorldInteractionKind;
  x: number;
  y: number;
}>;

export type WorldInteractionActor = Readonly<{
  x: number;
  y: number;
  facing: FacingDirection;
}>;

export type WorldInteractionTargetingOptions = Readonly<{
  maxDistance: number;
  forwardTolerance: number;
}>;

export const DEFAULT_WORLD_INTERACTION_TARGETING = Object.freeze({
  maxDistance: 84,
  forwardTolerance: 24,
});

function isInsideFacingLane(
  dx: number,
  dy: number,
  facing: FacingDirection,
  tolerance: number,
): boolean {
  if (facing === 'up') {
    return dy <= 0 && Math.abs(dx) <= tolerance;
  }
  if (facing === 'down') {
    return dy >= 0 && Math.abs(dx) <= tolerance;
  }
  if (facing === 'left') {
    return dx <= 0 && Math.abs(dy) <= tolerance;
  }
  return dx >= 0 && Math.abs(dy) <= tolerance;
}

export function resolveWorldInteractionTarget(
  actor: WorldInteractionActor,
  candidates: readonly WorldInteractionTarget[],
  options: WorldInteractionTargetingOptions =
    DEFAULT_WORLD_INTERACTION_TARGETING,
): WorldInteractionTarget | undefined {
  let closest:
    | Readonly<{ target: WorldInteractionTarget; distance: number }>
    | undefined;

  for (const target of candidates) {
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const distance = Math.hypot(dx, dy);
    if (
      distance > options.maxDistance ||
      !isInsideFacingLane(dx, dy, actor.facing, options.forwardTolerance)
    ) {
      continue;
    }

    if (
      closest === undefined ||
      distance < closest.distance ||
      (distance === closest.distance && target.id < closest.target.id)
    ) {
      closest = Object.freeze({ target, distance });
    }
  }

  return closest?.target;
}

export function requiredInteractionKind(
  action: FarmLoopTutorialAction,
): WorldInteractionKind | undefined {
  if (
    action === 'till' ||
    action === 'plant' ||
    action === 'water' ||
    action === 'harvest'
  ) {
    return 'farm_tile';
  }
  if (action === 'next_day') {
    return 'bed';
  }
  if (action === 'sell') {
    return 'shipping_bin';
  }

  return undefined;
}
