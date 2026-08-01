import Phaser from 'phaser';
import {
  CROP_GROWTH_STAGE_COUNT,
  getCropTextureKey,
} from './createCropTextures';

export const CROP_BENCHMARK_INSTANCE_COUNT = 300;
export type CropBenchmarkStrategy = 'baseline' | 'naive' | 'static';

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

export class CropBenchmarkController {
  private readonly crops: CropInstance[] = [];
  private readonly strategy: CropBenchmarkStrategy;

  public constructor(
    scene: Phaser.Scene,
    strategy: CropBenchmarkStrategy,
  ) {
    this.strategy = strategy;

    if (strategy === 'baseline') {
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
    return this.crops.length;
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
