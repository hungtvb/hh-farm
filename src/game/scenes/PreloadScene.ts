import Phaser from 'phaser';
import { preloadRuntimeArtPack } from '../assets/runtimeArtPack';
import { preloadVisualAssets } from '../assets/visualAssets';
import { preloadFarmWorld } from '../world/farmWorld';

function getTargetSceneKey(): string {
  const benchmark = new URLSearchParams(window.location.search).get(
    'benchmark',
  );

  return benchmark === 'crops' ? 'crop-benchmark' : 'farm';
}

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super('preload');
  }

  public preload(): void {
    preloadFarmWorld(this);
    preloadVisualAssets(this);
    preloadRuntimeArtPack(this);
  }

  public create(): void {
    this.scene.start(getTargetSceneKey());
  }
}
