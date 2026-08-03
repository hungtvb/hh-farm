import Phaser from 'phaser';
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
  }

  public create(): void {
    this.scene.start(getTargetSceneKey());
  }
}
