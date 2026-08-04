import type { FacingDirection } from '../../domain/player/movement.js';

export const ART_PACK_DIRECTIONS: readonly FacingDirection[] = Object.freeze([
  'down',
  'left',
  'right',
  'up',
]);

export type PlayerAnimationId =
  | 'player.harvest'
  | 'player.hoe'
  | 'player.idle'
  | 'player.walk'
  | 'player.water';

export type PlayerAnimationContract = Readonly<{
  id: PlayerAnimationId;
  framesPerDirection: number;
  frameDurationMs: number;
  loop: boolean;
  impactFrameIndex: number | null;
}>;

export type PlayerFrameAddress = Readonly<{
  animationId: PlayerAnimationId;
  direction: FacingDirection;
  frameIndex: number;
  stableFrameKey: string;
}>;

export const PLAYER_FRAME_WIDTH = 64;
export const PLAYER_FRAME_HEIGHT = 80;
export const PLAYER_ORIGIN = Object.freeze({ x: 0.5, y: 1 });
export const PLAYER_FOOT_Y = 72;
export const PLAYER_BODY = Object.freeze({
  width: 24,
  height: 14,
  offsetX: 20,
  offsetY: 62,
});

export const PLAYER_ANIMATIONS: Readonly<
  Record<PlayerAnimationId, PlayerAnimationContract>
> = Object.freeze({
  'player.idle': Object.freeze({
    id: 'player.idle',
    framesPerDirection: 4,
    frameDurationMs: 280,
    loop: true,
    impactFrameIndex: null,
  }),
  'player.walk': Object.freeze({
    id: 'player.walk',
    framesPerDirection: 6,
    frameDurationMs: 110,
    loop: true,
    impactFrameIndex: null,
  }),
  'player.hoe': Object.freeze({
    id: 'player.hoe',
    framesPerDirection: 5,
    frameDurationMs: 90,
    loop: false,
    impactFrameIndex: 2,
  }),
  'player.water': Object.freeze({
    id: 'player.water',
    framesPerDirection: 6,
    frameDurationMs: 90,
    loop: false,
    impactFrameIndex: 3,
  }),
  'player.harvest': Object.freeze({
    id: 'player.harvest',
    framesPerDirection: 5,
    frameDurationMs: 85,
    loop: false,
    impactFrameIndex: 2,
  }),
});

function requireFrameIndex(
  animation: PlayerAnimationContract,
  frameIndex: number,
): number {
  if (
    !Number.isInteger(frameIndex) ||
    frameIndex < 0 ||
    frameIndex >= animation.framesPerDirection
  ) {
    throw new Error(
      `Frame index ${String(frameIndex)} is invalid for ${animation.id}.`,
    );
  }

  return frameIndex;
}

export function getPlayerFrameAddress(
  animationId: PlayerAnimationId,
  direction: FacingDirection,
  frameIndex: number,
): PlayerFrameAddress {
  const animation = PLAYER_ANIMATIONS[animationId];
  requireFrameIndex(animation, frameIndex);

  return Object.freeze({
    animationId,
    direction,
    frameIndex,
    stableFrameKey: `${animationId}.${direction}.${String(frameIndex + 1).padStart(2, '0')}`,
  });
}

export function getPlayerAnimationDurationMs(
  animationId: PlayerAnimationId,
): number {
  const animation = PLAYER_ANIMATIONS[animationId];
  return animation.framesPerDirection * animation.frameDurationMs;
}

export function getPlayerImpactTimeMs(
  animationId: PlayerAnimationId,
): number | null {
  const animation = PLAYER_ANIMATIONS[animationId];
  return animation.impactFrameIndex === null
    ? null
    : animation.impactFrameIndex * animation.frameDurationMs;
}

export function listPlayerFrameAddresses(
  animationId: PlayerAnimationId,
): readonly PlayerFrameAddress[] {
  const animation = PLAYER_ANIMATIONS[animationId];
  return Object.freeze(
    ART_PACK_DIRECTIONS.flatMap((direction) =>
      Array.from({ length: animation.framesPerDirection }, (_, frameIndex) =>
        getPlayerFrameAddress(animationId, direction, frameIndex),
      ),
    ),
  );
}
