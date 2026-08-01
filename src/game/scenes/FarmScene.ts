import Phaser from 'phaser';
import { createPlayerTextures } from '../player/createPlayerTextures';
import {
  createPlayerCollisionWorld,
  type PlayerCollisionWorld,
} from '../player/collisionWorld';
import { PlayerController } from '../player/PlayerController';
import { createFarmWorld, FARM_MAP_KEY } from '../world/farmWorld';

export class FarmScene extends Phaser.Scene {
  private playerController?: PlayerController;
  private collisionWorld?: PlayerCollisionWorld;
  private sceneInstance = 0;

  public constructor() {
    super('farm');
  }

  public create(): void {
    this.sceneInstance += 1;

    const { map, metadata } = createFarmWorld(this);
    const debugGraphics = this.add.graphics().setDepth(9_000);
    const mapSummary = [
      `${String(map.width)}×${String(map.height)} tiles`,
      `${String(metadata.collisions.length)} collision regions`,
      'Arrow keys / WASD · R to restart',
    ].join(' · ');

    this.game.canvas.dataset.scene = this.scene.key;
    this.game.canvas.dataset.map = FARM_MAP_KEY;
    this.game.canvas.dataset.playerSpawn = metadata.playerSpawn.stableId;
    this.game.canvas.dataset.collisionCount = String(metadata.collisions.length);

    debugGraphics.lineStyle(2, 0x355f36, 0.4);
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

    createPlayerTextures(this);
    this.playerController = new PlayerController(this, {
      sceneInstance: this.sceneInstance,
      spawnX: metadata.playerSpawn.x,
      spawnY: metadata.playerSpawn.y,
    });
    this.collisionWorld = createPlayerCollisionWorld(
      this,
      this.playerController.sprite,
      metadata.collisions,
    );

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const camera = this.cameras.main;
    camera.roundPixels = true;
    camera.centerOn(
      this.playerController.sprite.x,
      this.playerController.sprite.y,
    );
    camera.startFollow(this.playerController.sprite, true, 0.2, 0.2);

    this.add
      .text(16, 16, 'HH Farm · Player prototype', {
        backgroundColor: '#f6f1d8dd',
        color: '#244a26',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        padding: { x: 12, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(20_000);

    this.add
      .text(16, 58, mapSummary, {
        backgroundColor: '#f6f1d8cc',
        color: '#355f36',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(20_000);

    this.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.handleShutdown,
      this,
    );
  }

  public update(_time: number, delta: number): void {
    this.playerController?.update(delta);
  }

  private handleShutdown(): void {
    this.collisionWorld?.destroy();
    this.collisionWorld = undefined;
    this.playerController?.destroy();
    this.playerController = undefined;
  }
}
