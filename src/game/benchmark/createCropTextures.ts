import Phaser from 'phaser';

export const CROP_GROWTH_STAGE_COUNT = 5;

const TEXTURE_WIDTH = 24;
const TEXTURE_HEIGHT = 32;

export function getCropTextureKey(stage: number): string {
  return `benchmark-crop-stage-${String(stage)}`;
}

function drawCropStage(
  graphics: Phaser.GameObjects.Graphics,
  stage: number,
): void {
  graphics.clear();

  graphics.fillStyle(0x4d3525, 0.28);
  graphics.fillEllipse(12, 29, 18, 5);

  graphics.fillStyle(0x4d7d38, 1);
  graphics.fillRect(11, 17 - stage * 2, 2, 12 + stage * 2);

  if (stage === 0) {
    graphics.fillStyle(0xd9b05d, 1);
    graphics.fillCircle(12, 24, 3);
    return;
  }

  graphics.fillStyle(0x72a94e, 1);
  graphics.fillEllipse(8, 20 - stage, 8 + stage, 5 + stage / 2);
  graphics.fillEllipse(16, 17 - stage * 1.5, 8 + stage, 5 + stage / 2);

  if (stage >= 3) {
    graphics.fillStyle(stage === 4 ? 0xe5b94f : 0x9acb62, 1);
    graphics.fillCircle(12, 11 - stage, 4 + stage / 2);
  }
}

export function createCropBenchmarkTextures(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics().setVisible(false);

  for (let stage = 0; stage < CROP_GROWTH_STAGE_COUNT; stage += 1) {
    const key = getCropTextureKey(stage);

    if (scene.textures.exists(key)) {
      continue;
    }

    drawCropStage(graphics, stage);
    graphics.generateTexture(key, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  }

  graphics.destroy();
}
