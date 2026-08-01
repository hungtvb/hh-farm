import Phaser from 'phaser';
import {
  CROP_GROWTH_STAGE_COUNT,
  getCropTextureKey,
} from './createCropTextures';

export const CROP_BENCHMARK_INSTANCE_COUNT = 300;
export type CropBenchmarkStrategy =
  | 'baseline'
  | 'batched'
  | 'naive'
  | 'static';

type CropInstance = Readonly<{
  image: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
}>;

const COLUMN_COUNT = 25;
const ROW_COUNT = 12;
const START_X = 144;
const START_Y = 92;
const COLUMN_SPACING = 28;
const ROW_SPACING = 31;
const CROP_TEXTURE_WIDTH = 24;
const CROP_TEXTURE_HEIGHT = 32;
const BATCH_LEFT = START_X - CROP_TEXTURE_WIDTH / 2;
const BATCH_TOP = START_Y - CROP_TEXTURE_HEIGHT;
const BATCH_WIDTH =
  (COLUMN_COUNT - 1) * COLUMN_SPACING + CROP_TEXTURE_WIDTH;
const BATCH_HEIGHT =
  (ROW_COUNT - 1) * ROW_SPACING + CROP_TEXTURE_HEIGHT;

export class CropBenchmarkController {
  private readonly crops: CropInstance[] = [];
  private readonly strategy: CropBenchmarkStrategy;
  private readonly logicalCropCount: number;

  public constructor(
    scene: Phaser.Scene,
    strategy: CropBenchmarkStrategy,
  ) {
    this.strategy = strategy;
    this.logicalCropCount =
      strategy === 'baseline' ? 0 : CROP_BENCHMARK_INSTANCE_COUNT;

    if (strategy === 'baseline') {
      return;
    }

    if (strategy === 'batched') {
      const renderTexture = scene.add
        .renderTexture(
          BATCH_LEFT,
          BATCH_TOP,
          BATCH_WIDTH,
          BATCH_HEIGHT,
        )
        .setOrigin(0, 0)
        .setDepth(90)
        .setName('benchmark-crop-batch');

      for (let index = 0; index < CROP_BENCHMARK_INSTANCE_COUNT; index += 1) {
        const column = index % COLUMN_COUNT;
        const row = Math.floor(index / COLUMN_COUNT);
        const stage = index % CROP_GROWTH_STAGE_COUNT;
        const worldX = START_X + column * COLUMN_SPACING;
        const worldY = START_Y + row * ROW_SPACING;

        renderTexture.stamp(
          getCropTextureKey(stage),
          null,
          worldX - BATCH_LEFT,
          worldY - BATCH_TOP,
          { originX: 0.5, originY: 1 },
        );
      }

      renderTexture.render();
      return;
    }

    for (let index = 0; index < CROP_BENCHMARK_INSTANCE_COUNT; index += 1) {
      const column = index % COLUMN_COUNT;
      const row = Math.floor(index / COLUMN_COUNT);
      const baseY = START_Y + row * ROW_SPACING;
      const stage = index % CROP_GROWTH_STAGE_COUNT;
      const image = scene.add
        .image(
          START_X + column * COLUMN_SPACING,
          baseY,
          getCropTextureKey(stage),
        )
        .setOrigin(0.5, 1)
        .setDepth(baseY);

      this.crops.push({
        image,
        baseY,
        phase: index * 0.37,
      });
    }

    if (this.crops.length !== COLUMN_COUNT * ROW_COUNT) {
      throw new Error('Crop benchmark fixture dimensions do not equal 300.');
    }
  }

  public get count(): number {
    return this.logicalCropCount;
  }

  public update(timeMs: number): void {
    if (this.strategy !== 'naive') {
      return;
    }

    for (const crop of this.crops) {
      const yOffset = Math.sin(timeMs * 0.004 + crop.phase) * 0.75;
      const nextY = crop.baseY + yOffset;

      crop.image.setY(nextY).setDepth(Math.round(nextY));
    }
  }
}
