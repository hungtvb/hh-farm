import Phaser from 'phaser';
import { BrowserBenchmarkProbe } from '../benchmark/BrowserBenchmarkProbe';
import {
  CropBenchmarkController,
  type CropBenchmarkStrategy,
} from '../benchmark/CropBenchmarkController';
import { createCropBenchmarkTextures } from '../benchmark/createCropTextures';
import { createFarmWorld, FARM_MAP_KEY } from '../world/farmWorld';

let benchmarkSceneCreateCount = 0;
let benchmarkSceneShutdownCount = 0;
let benchmarkRestartRequestCount = 0;

function readBenchmarkStrategy(): CropBenchmarkStrategy {
  const strategy = new URLSearchParams(window.location.search).get('strategy');

  if (
    strategy === 'baseline' ||
    strategy === 'batched' ||
    strategy === 'naive'
  ) {
    return strategy;
  }

  return 'static';
}

export class CropBenchmarkScene extends Phaser.Scene {
  private crops: CropBenchmarkController | undefined;
  private probe: BrowserBenchmarkProbe | undefined;

  public constructor() {
    super('crop-benchmark');
  }

  public create(): void {
    benchmarkSceneCreateCount += 1;

    const strategy = readBenchmarkStrategy();
    const { map } = createFarmWorld(this);
    const { canvas } = this.game;

    createCropBenchmarkTextures(this);
    this.crops = new CropBenchmarkController(this, strategy);

    const camera = this.cameras.main;
    camera.stopFollow();
    camera.roundPixels = true;
    camera.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);

    this.add
      .text(16, 16, 'HH Farm · crop render benchmark', {
        backgroundColor: '#f6f1d8ee',
        color: '#244a26',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(20_000);

    this.add
      .text(
        16,
        58,
        `${strategy} · ${String(this.crops.count)} crops · R to restart`,
        {
          backgroundColor: '#f6f1d8dd',
          color: '#355f36',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '13px',
          padding: { x: 10, y: 6 },
        },
      )
      .setScrollFactor(0)
      .setDepth(20_000);

    canvas.dataset.scene = this.scene.key;
    canvas.dataset.map = FARM_MAP_KEY;
    canvas.dataset.benchmarkStrategy = strategy;
    canvas.dataset.benchmarkAssetSet = 'procedural-crop-v1';
    canvas.dataset.cropCount = String(this.crops.count);
    canvas.dataset.benchmarkSceneInstance = String(benchmarkSceneCreateCount);
    canvas.dataset.benchmarkSceneShutdownCount = String(
      benchmarkSceneShutdownCount,
    );
    canvas.dataset.benchmarkRestartRequestCount = String(
      benchmarkRestartRequestCount,
    );
    canvas.dataset.benchmarkDisplayObjectCount = String(
      this.children.list.length,
    );

    if (this.input.keyboard === null) {
      throw new Error('Keyboard input is required for the crop benchmark.');
    }

    const restartKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R,
    );
    restartKey.on('down', this.handleRestart);

    this.probe = new BrowserBenchmarkProbe(canvas);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);
  }

  public update(time: number): void {
    this.crops?.update(time);
  }

  private readonly handleRestart = (): void => {
    benchmarkRestartRequestCount += 1;
    this.game.canvas.dataset.benchmarkRestartRequestCount = String(
      benchmarkRestartRequestCount,
    );
    this.scene.restart();
  };

  private readonly handleShutdown = (): void => {
    benchmarkSceneShutdownCount += 1;
    this.game.canvas.dataset.benchmarkSceneShutdownCount = String(
      benchmarkSceneShutdownCount,
    );
    this.probe?.destroy();
    this.probe = undefined;
    this.crops = undefined;
  };
}
