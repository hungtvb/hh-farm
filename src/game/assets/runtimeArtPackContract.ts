import type { FarmLoopTutorialAction } from '../../application/farmLoop/farmLoopCoordinator';
import type { FacingDirection } from '../../domain/player/movement';
import type { PlayerAnimationId } from './artPackContract';

export type RuntimeFrameRecord = Readonly<{
  stableFrameKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type RuntimeFrameSheetMetadata = Readonly<{
  textureId: string;
  sourceFile: string;
  frameWidth: number;
  frameHeight: number;
  usedFrames: number;
  frames: readonly RuntimeFrameRecord[];
}>;

export type RuntimeCropId = 'turnip' | 'carrot' | 'strawberry';
export type RuntimeEnvironmentKind = 'grass' | 'water' | 'wood';

export const RUNTIME_ART_TEXTURE_KEYS = Object.freeze({
  player: 'runtime-art-player',
  environmentGrass: 'runtime-art-environment-grass',
  environmentWater: 'runtime-art-environment-water',
  environmentWood: 'runtime-art-environment-wood',
  cropTurnip: 'runtime-art-crop-turnip',
  cropCarrot: 'runtime-art-crop-carrot',
  cropStrawberry: 'runtime-art-crop-strawberry',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  value: unknown,
  fieldName: string,
  context: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context}.${fieldName} must be a non-empty string.`);
  }
  return value;
}

function requirePositiveInteger(
  value: unknown,
  fieldName: string,
  context: string,
): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${context}.${fieldName} must be a positive integer.`);
  }
  return value as number;
}

function requireNonNegativeInteger(
  value: unknown,
  fieldName: string,
  context: string,
): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${context}.${fieldName} must be a non-negative integer.`);
  }
  return value as number;
}

export function parseRuntimeFrameSheetMetadata(
  raw: unknown,
  expectedTextureId: string,
): RuntimeFrameSheetMetadata {
  const context = `Runtime art metadata "${expectedTextureId}"`;
  if (!isRecord(raw)) {
    throw new Error(`${context} must be an object.`);
  }

  const textureId = requireString(raw.textureId, 'textureId', context);
  if (textureId !== expectedTextureId) {
    throw new Error(
      `${context}.textureId expected "${expectedTextureId}", received "${textureId}".`,
    );
  }

  const framesRaw = raw.frames;
  if (!Array.isArray(framesRaw) || framesRaw.length === 0) {
    throw new Error(`${context}.frames must be a non-empty array.`);
  }

  const frameKeys = new Set<string>();
  const frames = framesRaw.map((frameRaw, index) => {
    const frameContext = `${context}.frames[${String(index)}]`;
    if (!isRecord(frameRaw)) {
      throw new Error(`${frameContext} must be an object.`);
    }

    const stableFrameKey = requireString(
      frameRaw.stableFrameKey,
      'stableFrameKey',
      frameContext,
    );
    if (frameKeys.has(stableFrameKey)) {
      throw new Error(`${context} contains duplicate frame "${stableFrameKey}".`);
    }
    frameKeys.add(stableFrameKey);

    return Object.freeze({
      stableFrameKey,
      x: requireNonNegativeInteger(frameRaw.x, 'x', frameContext),
      y: requireNonNegativeInteger(frameRaw.y, 'y', frameContext),
      width: requirePositiveInteger(frameRaw.width, 'width', frameContext),
      height: requirePositiveInteger(frameRaw.height, 'height', frameContext),
    });
  });

  const usedFrames = requirePositiveInteger(raw.usedFrames, 'usedFrames', context);
  if (usedFrames !== frames.length) {
    throw new Error(
      `${context}.usedFrames expected ${String(frames.length)}, received ${String(usedFrames)}.`,
    );
  }

  return Object.freeze({
    textureId,
    sourceFile: requireString(raw.sourceFile, 'sourceFile', context),
    frameWidth: requirePositiveInteger(raw.frameWidth, 'frameWidth', context),
    frameHeight: requirePositiveInteger(raw.frameHeight, 'frameHeight', context),
    usedFrames,
    frames: Object.freeze(frames),
  });
}

export function getPlayerAnimationKey(
  animationId: PlayerAnimationId,
  direction: FacingDirection,
): string {
  return `runtime:${animationId}:${direction}`;
}

export function getCropTextureKey(cropId: string): string {
  if (cropId === 'turnip') {
    return RUNTIME_ART_TEXTURE_KEYS.cropTurnip;
  }
  if (cropId === 'carrot') {
    return RUNTIME_ART_TEXTURE_KEYS.cropCarrot;
  }
  if (cropId === 'strawberry') {
    return RUNTIME_ART_TEXTURE_KEYS.cropStrawberry;
  }
  throw new Error(`Unsupported runtime crop "${cropId}".`);
}

export function getCropFrameKey(cropId: string, stage: number): string {
  if (!Number.isInteger(stage) || stage < 0 || stage > 3) {
    throw new Error(`Runtime crop stage ${String(stage)} is invalid.`);
  }
  getCropTextureKey(cropId);
  return `crop.${cropId}.stage.${String(stage).padStart(2, '0')}`;
}

export function getEnvironmentTextureKey(
  kind: RuntimeEnvironmentKind,
): string {
  if (kind === 'grass') {
    return RUNTIME_ART_TEXTURE_KEYS.environmentGrass;
  }
  if (kind === 'water') {
    return RUNTIME_ART_TEXTURE_KEYS.environmentWater;
  }
  return RUNTIME_ART_TEXTURE_KEYS.environmentWood;
}

export function getEnvironmentFrameKey(
  kind: RuntimeEnvironmentKind,
  variantIndex: number,
): string {
  if (!Number.isInteger(variantIndex) || variantIndex < 0 || variantIndex > 3) {
    throw new Error(`Environment variant ${String(variantIndex)} is invalid.`);
  }
  return `environment.${kind}.${String(variantIndex).padStart(2, '0')}`;
}

export function playerAnimationForFarmAction(
  action: FarmLoopTutorialAction,
): PlayerAnimationId {
  if (action === 'water') {
    return 'player.water';
  }
  if (action === 'harvest' || action === 'sell' || action === 'next_day') {
    return 'player.harvest';
  }
  return 'player.hoe';
}
