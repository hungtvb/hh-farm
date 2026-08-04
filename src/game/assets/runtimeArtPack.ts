import Phaser from 'phaser';
import {
  ART_PACK_DIRECTIONS,
  getPlayerFrameAddress,
  PLAYER_ANIMATIONS,
} from './artPackContract';
import {
  getPlayerAnimationKey,
  parseRuntimeFrameSheetMetadata,
  RUNTIME_ART_TEXTURE_KEYS,
  type RuntimeFrameSheetMetadata,
} from './runtimeArtPackContract';

export {
  getCropFrameKey,
  getCropTextureKey,
  getEnvironmentFrameKey,
  getEnvironmentTextureKey,
  getPlayerAnimationKey,
  parseRuntimeFrameSheetMetadata,
  playerAnimationForFarmAction,
  RUNTIME_ART_TEXTURE_KEYS,
} from './runtimeArtPackContract';
export type {
  RuntimeCropId,
  RuntimeEnvironmentKind,
  RuntimeFrameRecord,
  RuntimeFrameSheetMetadata,
} from './runtimeArtPackContract';

const GENERATED_ASSET_BASE = 'assets/generated';
const RUNTIME_ART_METADATA_KEYS = Object.freeze({
  player: 'runtime-art-player-metadata',
  environmentGrass: 'runtime-art-environment-grass-metadata',
  environmentWater: 'runtime-art-environment-water-metadata',
  environmentWood: 'runtime-art-environment-wood-metadata',
  cropTurnip: 'runtime-art-crop-turnip-metadata',
  cropCarrot: 'runtime-art-crop-carrot-metadata',
  cropStrawberry: 'runtime-art-crop-strawberry-metadata',
});
const PLAYER_SHEET_SIZE = Object.freeze({ width: 384, height: 1600 });
const FOUR_FRAME_SHEET_SIZE = Object.freeze({ width: 256, height: 64 });

export type RuntimeArtRegistration = Readonly<{
  playerFrameCount: number;
  environmentFrameCount: number;
  cropFrameCount: number;
}>;

function preloadSheet(
  scene: Phaser.Scene,
  textureKey: string,
  metadataKey: string,
  sourceFile: string,
  metadataFile: string,
  size: Readonly<{ width: number; height: number }>,
): void {
  scene.load.svg(textureKey, `${GENERATED_ASSET_BASE}/${sourceFile}`, size);
  scene.load.json(metadataKey, `${GENERATED_ASSET_BASE}/${metadataFile}`);
}

export function preloadRuntimeArtPack(scene: Phaser.Scene): void {
  preloadSheet(
    scene,
    RUNTIME_ART_TEXTURE_KEYS.player,
    RUNTIME_ART_METADATA_KEYS.player,
    'player-character.svg',
    'player-character.frames.json',
    PLAYER_SHEET_SIZE,
  );
  for (const [kind, textureKey, metadataKey] of [
    [
      'grass',
      RUNTIME_ART_TEXTURE_KEYS.environmentGrass,
      RUNTIME_ART_METADATA_KEYS.environmentGrass,
    ],
    [
      'water',
      RUNTIME_ART_TEXTURE_KEYS.environmentWater,
      RUNTIME_ART_METADATA_KEYS.environmentWater,
    ],
    [
      'wood',
      RUNTIME_ART_TEXTURE_KEYS.environmentWood,
      RUNTIME_ART_METADATA_KEYS.environmentWood,
    ],
  ] as const) {
    preloadSheet(
      scene,
      textureKey,
      metadataKey,
      `environment-${kind}.svg`,
      `environment-${kind}.frames.json`,
      FOUR_FRAME_SHEET_SIZE,
    );
  }
  for (const [cropId, textureKey, metadataKey] of [
    [
      'turnip',
      RUNTIME_ART_TEXTURE_KEYS.cropTurnip,
      RUNTIME_ART_METADATA_KEYS.cropTurnip,
    ],
    [
      'carrot',
      RUNTIME_ART_TEXTURE_KEYS.cropCarrot,
      RUNTIME_ART_METADATA_KEYS.cropCarrot,
    ],
    [
      'strawberry',
      RUNTIME_ART_TEXTURE_KEYS.cropStrawberry,
      RUNTIME_ART_METADATA_KEYS.cropStrawberry,
    ],
  ] as const) {
    preloadSheet(
      scene,
      textureKey,
      metadataKey,
      `crop-${cropId}.svg`,
      `crop-${cropId}.frames.json`,
      FOUR_FRAME_SHEET_SIZE,
    );
  }
}

function registerFrames(
  scene: Phaser.Scene,
  textureKey: string,
  metadataKey: string,
  expectedTextureId: string,
): RuntimeFrameSheetMetadata {
  const raw = scene.cache.json.get(metadataKey) as unknown;
  const metadata = parseRuntimeFrameSheetMetadata(raw, expectedTextureId);
  const texture = scene.textures.get(textureKey);

  for (const frame of metadata.frames) {
    if (!texture.has(frame.stableFrameKey)) {
      const added = texture.add(
        frame.stableFrameKey,
        0,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
      );
      if (added === null) {
        throw new Error(
          `Unable to register runtime art frame "${frame.stableFrameKey}".`,
        );
      }
    }
  }

  return metadata;
}

function registerPlayerAnimations(scene: Phaser.Scene): void {
  for (const animation of Object.values(PLAYER_ANIMATIONS)) {
    for (const direction of ART_PACK_DIRECTIONS) {
      const key = getPlayerAnimationKey(animation.id, direction);
      if (scene.anims.exists(key)) {
        continue;
      }

      const frames = Array.from(
        { length: animation.framesPerDirection },
        (_, frameIndex) => ({
          key: RUNTIME_ART_TEXTURE_KEYS.player,
          frame: getPlayerFrameAddress(animation.id, direction, frameIndex)
            .stableFrameKey,
          duration: animation.frameDurationMs,
        }),
      );
      const created = scene.anims.create({
        key,
        frames,
        repeat: animation.loop ? -1 : 0,
        skipMissedFrames: false,
      });
      if (created === false) {
        throw new Error(`Unable to create player animation "${key}".`);
      }
    }
  }
}

export function registerRuntimeArtPack(
  scene: Phaser.Scene,
): RuntimeArtRegistration {
  const player = registerFrames(
    scene,
    RUNTIME_ART_TEXTURE_KEYS.player,
    RUNTIME_ART_METADATA_KEYS.player,
    'player.character',
  );
  const environment = [
    registerFrames(
      scene,
      RUNTIME_ART_TEXTURE_KEYS.environmentGrass,
      RUNTIME_ART_METADATA_KEYS.environmentGrass,
      'environment.grass',
    ),
    registerFrames(
      scene,
      RUNTIME_ART_TEXTURE_KEYS.environmentWater,
      RUNTIME_ART_METADATA_KEYS.environmentWater,
      'environment.water',
    ),
    registerFrames(
      scene,
      RUNTIME_ART_TEXTURE_KEYS.environmentWood,
      RUNTIME_ART_METADATA_KEYS.environmentWood,
      'environment.wood',
    ),
  ];
  const crops = [
    registerFrames(
      scene,
      RUNTIME_ART_TEXTURE_KEYS.cropTurnip,
      RUNTIME_ART_METADATA_KEYS.cropTurnip,
      'crop.turnip.stages',
    ),
    registerFrames(
      scene,
      RUNTIME_ART_TEXTURE_KEYS.cropCarrot,
      RUNTIME_ART_METADATA_KEYS.cropCarrot,
      'crop.carrot.stages',
    ),
    registerFrames(
      scene,
      RUNTIME_ART_TEXTURE_KEYS.cropStrawberry,
      RUNTIME_ART_METADATA_KEYS.cropStrawberry,
      'crop.strawberry.stages',
    ),
  ];

  registerPlayerAnimations(scene);

  const registration = Object.freeze({
    playerFrameCount: player.usedFrames,
    environmentFrameCount: environment.reduce(
      (total, metadata) => total + metadata.usedFrames,
      0,
    ),
    cropFrameCount: crops.reduce(
      (total, metadata) => total + metadata.usedFrames,
      0,
    ),
  });
  const { canvas } = scene.game;
  canvas.dataset.artPackRuntime = 'source-pack-v1';
  canvas.dataset.artPackPlayerFrameCount = String(
    registration.playerFrameCount,
  );
  canvas.dataset.artPackEnvironmentFrameCount = String(
    registration.environmentFrameCount,
  );
  canvas.dataset.artPackCropFrameCount = String(registration.cropFrameCount);
  return registration;
}
