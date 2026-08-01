import Phaser from 'phaser';
import { preloadFarmWorld } from '../world/farmWorld';

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super('preload');
  }

  public preload(): void {
    preloadFarmWorld(this);
  }

  public create(): void {
    this.scene.start('farm');
  }
}
