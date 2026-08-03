import type { FarmLoopTutorialAction } from '../../application/farmLoop/farmLoopCoordinator.js';
import type { FacingDirection } from '../player/movement.js';
import type {
  WorldInteractionActor,
  WorldInteractionKind,
  WorldInteractionTarget,
} from './worldInteractionTarget.js';

export type WorldInteractionApproach = Readonly<{
  x: number;
  y: number;
  facing: FacingDirection;
}>;

export type WorldInteractionIntent = Readonly<{
  action: FarmLoopTutorialAction;
  target: WorldInteractionTarget;
  approach: WorldInteractionApproach;
}>;

export type WorldInteractionApproachOptions = Readonly<{
  farmTileDistance: number;
  worldObjectDistance: number;
}>;

export const DEFAULT_WORLD_INTERACTION_APPROACH = Object.freeze({
  farmTileDistance: 52,
  worldObjectDistance: 68,
});

type ApproachCandidate = WorldInteractionApproach &
  Readonly<{
    stableOrder: number;
  }>;

function interactionDistance(
  kind: WorldInteractionKind,
  options: WorldInteractionApproachOptions,
): number {
  return kind === 'farm_tile'
    ? options.farmTileDistance
    : options.worldObjectDistance;
}

function approachCandidates(
  target: WorldInteractionTarget,
  distance: number,
): readonly ApproachCandidate[] {
  return Object.freeze([
    Object.freeze({
      x: target.x,
      y: target.y + distance,
      facing: 'up' as const,
      stableOrder: 0,
    }),
    Object.freeze({
      x: target.x - distance,
      y: target.y,
      facing: 'right' as const,
      stableOrder: 1,
    }),
    Object.freeze({
      x: target.x + distance,
      y: target.y,
      facing: 'left' as const,
      stableOrder: 2,
    }),
    Object.freeze({
      x: target.x,
      y: target.y - distance,
      facing: 'down' as const,
      stableOrder: 3,
    }),
  ]);
}

export function resolveWorldInteractionApproach(
  actor: WorldInteractionActor,
  target: WorldInteractionTarget,
  options: WorldInteractionApproachOptions =
    DEFAULT_WORLD_INTERACTION_APPROACH,
): WorldInteractionApproach {
  const distance = interactionDistance(target.kind, options);
  const candidates = approachCandidates(target, distance);
  const selected = [...candidates].sort((left, right) => {
    const leftDistance = Math.hypot(left.x - actor.x, left.y - actor.y);
    const rightDistance = Math.hypot(right.x - actor.x, right.y - actor.y);
    return leftDistance - rightDistance || left.stableOrder - right.stableOrder;
  })[0];

  if (selected === undefined) {
    throw new Error(`Unable to resolve approach point for target "${target.id}".`);
  }

  return Object.freeze({
    x: selected.x,
    y: selected.y,
    facing: selected.facing,
  });
}

export function createWorldInteractionIntent(
  actor: WorldInteractionActor,
  target: WorldInteractionTarget,
  action: FarmLoopTutorialAction,
  options?: WorldInteractionApproachOptions,
): WorldInteractionIntent {
  return Object.freeze({
    action,
    target,
    approach: resolveWorldInteractionApproach(actor, target, options),
  });
}
