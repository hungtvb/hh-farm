import Phaser from 'phaser';
import { createFarmWorld, FARM_MAP_KEY } from '../world/farmWorld';

export class FarmScene extends Phaser.Scene {
  public constructor() {
    super('farm');
  }

  public create(): void {
    const { map, metadata } = createFarmWorld(this);
    const debugGraphics = this.add.graphics().setDepth(10);
    const mapSummary = [
      `${String(map.width)}×${String(map.height)} tiles`,
      `${String(metadata.collisions.length)} collision regions`,
      `${String(metadata.farmableRegions.length)} farmable region`,
    ].join(' · ');

    this.game.canvas.dataset.scene = this.scene.key;
    this.game.canvas.dataset.map = FARM_MAP_KEY;
    this.game.canvas.dataset.playerSpawn = metadata.playerSpawn.stableId;
    this.game.canvas.dataset.collisionCount = String(metadata.collisions.length);

    debugGraphics.lineStyle(2, 0x355f36, 0.55);
    for (const collision of metadata.collisions) {
      debugGraphics.strokeRect(
        collision.x,
        collision.y,
        collision.width,
        collision.height,
      );
    }

    debugGraphics.lineStyle(3, 0xf5df9b, 0.9);
    for (const farmableRegion of metadata.farmableRegions) {
      debugGraphics.strokeRoundedRect(
        farmableRegion.x,
        farmableRegion.y,
        farmableRegion.width,
        farmableRegion.height,
        12,
      );
    }

    this.add
      .circle(
        metadata.playerSpawn.x,
        metadata.playerSpawn.y,
        11,
        0xf5df9b,
        1,
      )
      .setStrokeStyle(3, 0x355f36)
      .setDepth(11);

    this.add
      .text(16, 16, 'HH Farm · Tiled contract v1', {
        backgroundColor: '#f6f1d8dd',
        color: '#244a26',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(16, 58, mapSummary, {
        backgroundColor: '#f6f1d8cc',
        color: '#355f36',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(100);
  }
}
