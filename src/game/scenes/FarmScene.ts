import Phaser from 'phaser';
import { VISUAL_TEXTURE_KEYS } from '../assets/visualAssets';
import { createPlayerTextures } from '../player/createPlayerTextures';
import { createPlayerCollisionWorld } from '../player/collisionWorld';
import { PlayerController } from '../player/PlayerController';
import { createFarmWorld, FARM_MAP_KEY } from '../world/farmWorld';

let farmSceneCreateCount = 0;
let farmSceneShutdownCount = 0;

export class FarmScene extends Phaser.Scene {
  private playerController: PlayerController | undefined;

  public constructor() {
    super('farm');
  }

  public create(): void {
    farmSceneCreateCount += 1;

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
    this.game.canvas.dataset.sceneInstance = String(farmSceneCreateCount);
    this.game.canvas.dataset.sceneShutdownCount = String(farmSceneShutdownCount);
    this.game.canvas.dataset.mapSummary = mapSummary;

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

    const visualPrototypeRegion = metadata.farmableRegions[0];
    if (visualPrototypeRegion === undefined) {
      throw new Error('Farm map requires one farmable region for visual assets.');
    }

    const prototypeTextures = [
      VISUAL_TEXTURE_KEYS.soilUntilled,
      VISUAL_TEXTURE_KEYS.soilTilled,
      VISUAL_TEXTURE_KEYS.soilWatered,
    ] as const;
    const prototypeY = visualPrototypeRegion.y + 42;

    for (const [index, textureKey] of prototypeTextures.entries()) {
      this.add
        .image(
          visualPrototypeRegion.x + 42 + index * 66,
          prototypeY,
          textureKey,
        )
        .setDisplaySize(58, 58)
        .setDepth(8_000);
    }

    this.add
      .image(
        visualPrototypeRegion.x + 42,
        prototypeY,
        VISUAL_TEXTURE_KEYS.selectionCursor,
      )
      .setDisplaySize(62, 62)
      .setAlpha(0.95)
      .setDepth(8_010);
    this.game.canvas.dataset.visualAssetCount = '4';
    this.game.canvas.dataset.visualPrototype = 'soil-states';

    createPlayerTextures(this);
    this.playerController = new PlayerController(this, {
      sceneInstance: farmSceneCreateCount,
      spawnX: metadata.playerSpawn.x,
      spawnY: metadata.playerSpawn.y,
    });
    createPlayerCollisionWorld(
      this,
      this.playerController.sprite,
      metadata.collisions,
    );

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.writePhysicsDebugState();

    const camera = this.cameras.main;
    camera.roundPixels = true;
    camera.centerOn(
      this.playerController.sprite.x,
      this.playerController.sprite.y,
    );
    camera.startFollow(this.playerController.sprite, true, 1, 1);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);
  }

  public update(_time: number, delta: number): void {
    this.playerController?.update(delta);
  }

  private readonly handleShutdown = (): void => {
    farmSceneShutdownCount += 1;
    this.game.canvas.dataset.sceneShutdownCount = String(
      farmSceneShutdownCount,
    );
    this.playerController?.destroy();
    this.playerController = undefined;
  };

  private writePhysicsDebugState(): void {
    this.game.canvas.dataset.dynamicBodyCount = String(
      this.physics.world.bodies.size,
    );
    this.game.canvas.dataset.staticBodyCount = String(
      this.physics.world.staticBodies.size,
    );
  }
}
