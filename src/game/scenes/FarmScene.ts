import Phaser from 'phaser';
import type { FarmLoopTutorialAction } from '../../application/farmLoop/farmLoopCoordinator';
import {
  TUTORIAL_TILE_ID,
  type FarmLoopState,
} from '../../application/farmLoop/farmLoopState';
import { getFarmTile } from '../../domain/farming/farmTileState';
import { VISUAL_TEXTURE_KEYS } from '../assets/visualAssets';
import { createPlayerTextures } from '../player/createPlayerTextures';
import { createPlayerCollisionWorld } from '../player/collisionWorld';
import { PlayerController } from '../player/PlayerController';
import {
  FARM_GAME_RUNTIME_REGISTRY_KEY,
  requireFarmGameRuntime,
  type FarmGameRuntime,
} from '../runtime/farmGameRuntime';
import { createFarmWorld, FARM_MAP_KEY } from '../world/farmWorld';

const ACTION_KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.E,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
] as const;
const TARGET_DISTANCE = 84;
const TARGET_FORWARD_TOLERANCE = 20;
const TILE_DISPLAY_SIZE = 58;
const CROP_STAGE_SIZE = 64;

let farmSceneCreateCount = 0;
let farmSceneShutdownCount = 0;

function recommendedAction(
  step: FarmLoopState['tutorial']['step'],
): FarmLoopTutorialAction | undefined {
  if (
    step === 'till' ||
    step === 'plant' ||
    step === 'water' ||
    step === 'next_day' ||
    step === 'harvest' ||
    step === 'sell'
  ) {
    return step;
  }

  return undefined;
}

export class FarmScene extends Phaser.Scene {
  private playerController: PlayerController | undefined;
  private farmRuntime: FarmGameRuntime | undefined;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private soilVisual: Phaser.GameObjects.Image | undefined;
  private cropVisual: Phaser.GameObjects.Image | undefined;
  private selectionVisual: Phaser.GameObjects.Image | undefined;
  private actionHint: Phaser.GameObjects.Text | undefined;
  private tutorialTilePosition: Phaser.Math.Vector2 | undefined;
  private lastRenderedState: FarmLoopState | undefined;
  private actionPending = false;

  private readonly handleActionInput = (): void => {
    if (!this.actionPending) {
      void this.performRecommendedAction();
    }
  };

  public constructor() {
    super('farm');
  }

  public create(): void {
    farmSceneCreateCount += 1;

    const { map, metadata } = createFarmWorld(this);
    const mapSummary = [
      `${String(map.width)}×${String(map.height)} tiles`,
      `${String(metadata.collisions.length)} collision regions`,
      'Arrow keys / WASD · E or Space to act · R to restart',
    ].join(' · ');

    this.game.canvas.dataset.scene = this.scene.key;
    this.game.canvas.dataset.map = FARM_MAP_KEY;
    this.game.canvas.dataset.playerSpawn = metadata.playerSpawn.stableId;
    this.game.canvas.dataset.collisionCount = String(metadata.collisions.length);
    this.game.canvas.dataset.sceneInstance = String(farmSceneCreateCount);
    this.game.canvas.dataset.sceneShutdownCount = String(farmSceneShutdownCount);
    this.game.canvas.dataset.mapSummary = mapSummary;

    const diagnosticsEnabled = new URLSearchParams(window.location.search).has(
      'world-debug',
    );
    if (diagnosticsEnabled) {
      this.drawWorldDiagnostics(metadata);
    }

    const farmableRegion = metadata.farmableRegions[0];
    if (farmableRegion === undefined) {
      throw new Error('Farm map requires one farmable region.');
    }

    this.tutorialTilePosition = new Phaser.Math.Vector2(
      farmableRegion.x + farmableRegion.width / 2,
      farmableRegion.y + farmableRegion.height - 32,
    );
    this.createAuthoritativeTutorialTile(this.tutorialTilePosition);

    this.farmRuntime = requireFarmGameRuntime(
      this.game.registry.get(FARM_GAME_RUNTIME_REGISTRY_KEY),
    );
    this.renderFarmState(true);

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

    const keyboard = this.input.keyboard;
    if (keyboard === null) {
      throw new Error('Keyboard input is required for the desktop farm scene.');
    }
    this.actionKeys = ACTION_KEY_CODES.map((keyCode) =>
      keyboard.addKey(keyCode),
    );
    for (const key of this.actionKeys) {
      key.on('down', this.handleActionInput);
    }

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
    this.renderFarmState(false);
    this.updateTargetFeedback();
  }

  private createAuthoritativeTutorialTile(position: Phaser.Math.Vector2): void {
    this.soilVisual = this.add
      .image(position.x, position.y, VISUAL_TEXTURE_KEYS.soilUntilled)
      .setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE)
      .setDepth(position.y);
    this.cropVisual = this.add
      .image(position.x, position.y, VISUAL_TEXTURE_KEYS.cropTurnipStages)
      .setCrop(0, 0, CROP_STAGE_SIZE, CROP_STAGE_SIZE)
      .setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE)
      .setDepth(position.y + 1)
      .setVisible(false);
    this.selectionVisual = this.add
      .image(position.x, position.y, VISUAL_TEXTURE_KEYS.selectionCursor)
      .setDisplaySize(62, 62)
      .setAlpha(0.3)
      .setDepth(position.y + 2);
    this.actionHint = this.add
      .text(position.x, position.y - 46, 'E', {
        color: '#1f3b28',
        backgroundColor: '#fff8dc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(position.y + 3)
      .setVisible(false);

    this.game.canvas.dataset.visualAssetCount = '3';
    this.game.canvas.dataset.visualPrototype = 'authoritative-tutorial-tile';
    this.game.canvas.dataset.worldFarmTileId = TUTORIAL_TILE_ID;
  }

  private drawWorldDiagnostics(
    metadata: ReturnType<typeof createFarmWorld>['metadata'],
  ): void {
    const graphics = this.add.graphics().setDepth(9_000);
    graphics.lineStyle(2, 0x355f36, 0.4);
    for (const collision of metadata.collisions) {
      graphics.strokeRect(
        collision.x,
        collision.y,
        collision.width,
        collision.height,
      );
    }

    graphics.lineStyle(3, 0xf5df9b, 0.9);
    for (const farmableRegion of metadata.farmableRegions) {
      graphics.strokeRoundedRect(
        farmableRegion.x,
        farmableRegion.y,
        farmableRegion.width,
        farmableRegion.height,
        12,
      );
    }
  }

  private renderFarmState(force: boolean): void {
    const runtime = this.farmRuntime;
    if (runtime === undefined) {
      return;
    }

    const state = runtime.getState();
    if (!force && state === this.lastRenderedState) {
      return;
    }
    this.lastRenderedState = state;

    const tile = getFarmTile(state.field, TUTORIAL_TILE_ID);
    if (tile === undefined) {
      throw new Error(`Missing authoritative tile "${TUTORIAL_TILE_ID}".`);
    }

    const soilTexture = tile.watered
      ? VISUAL_TEXTURE_KEYS.soilWatered
      : tile.soil === 'tilled'
        ? VISUAL_TEXTURE_KEYS.soilTilled
        : VISUAL_TEXTURE_KEYS.soilUntilled;
    this.soilVisual?.setTexture(soilTexture);

    const crop = tile.crop;
    if (crop === null) {
      this.cropVisual?.setVisible(false);
    } else {
      this.cropVisual
        ?.setCrop(
          Math.min(crop.growthStageIndex, 3) * CROP_STAGE_SIZE,
          0,
          CROP_STAGE_SIZE,
          CROP_STAGE_SIZE,
        )
        .setVisible(true);
    }

    const canvas = this.game.canvas;
    canvas.dataset.worldSoil = tile.soil;
    canvas.dataset.worldWatered = String(tile.watered);
    canvas.dataset.worldCropStage = crop === null
      ? 'none'
      : String(crop.growthStageIndex);
    canvas.dataset.worldTutorialStep = state.tutorial.step;
    canvas.dataset.worldDay = String(state.farm.day);
    canvas.dataset.worldCoins = String(state.economy.wallet.coins);
  }

  private updateTargetFeedback(): void {
    const ready = this.isTutorialTileTargeted();
    this.selectionVisual?.setAlpha(ready ? 0.98 : 0.3);
    const action = recommendedAction(
      this.farmRuntime?.getState().tutorial.step ?? 'completed',
    );
    this.actionHint?.setVisible(ready && action !== undefined);
    this.game.canvas.dataset.worldTargetReady = String(ready);
  }

  private isTutorialTileTargeted(): boolean {
    const player = this.playerController;
    const target = this.tutorialTilePosition;
    if (player === undefined || target === undefined) {
      return false;
    }

    const dx = target.x - player.sprite.x;
    const dy = target.y - player.sprite.y;
    if (Math.hypot(dx, dy) > TARGET_DISTANCE) {
      return false;
    }

    const facing = player.getFacingDirection();
    if (facing === 'up') {
      return dy <= 0 && Math.abs(dx) <= TARGET_FORWARD_TOLERANCE;
    }
    if (facing === 'down') {
      return dy >= 0 && Math.abs(dx) <= TARGET_FORWARD_TOLERANCE;
    }
    if (facing === 'left') {
      return dx <= 0 && Math.abs(dy) <= TARGET_FORWARD_TOLERANCE;
    }
    return dx >= 0 && Math.abs(dy) <= TARGET_FORWARD_TOLERANCE;
  }

  private async performRecommendedAction(): Promise<void> {
    const runtime = this.farmRuntime;
    if (runtime === undefined || !this.isTutorialTileTargeted()) {
      return;
    }

    const action = recommendedAction(runtime.getState().tutorial.step);
    if (action === undefined) {
      return;
    }

    this.actionPending = true;
    this.game.canvas.dataset.worldActionPending = 'true';
    try {
      const result = await runtime.perform(action, TUTORIAL_TILE_ID);
      this.game.canvas.dataset.worldLastAction = action;
      this.game.canvas.dataset.worldLastResult = result.status;
      if ('code' in result) {
        this.game.canvas.dataset.worldLastFailure = result.code;
      } else {
        delete this.game.canvas.dataset.worldLastFailure;
      }
      this.renderFarmState(true);
    } finally {
      this.actionPending = false;
      this.game.canvas.dataset.worldActionPending = 'false';
    }
  }

  private readonly handleShutdown = (): void => {
    farmSceneShutdownCount += 1;
    this.game.canvas.dataset.sceneShutdownCount = String(
      farmSceneShutdownCount,
    );
    this.playerController?.destroy();
    this.playerController = undefined;
    this.farmRuntime = undefined;
    for (const key of this.actionKeys) {
      key.off('down', this.handleActionInput);
    }
    this.actionKeys = [];
    this.soilVisual = undefined;
    this.cropVisual = undefined;
    this.selectionVisual = undefined;
    this.actionHint = undefined;
    this.tutorialTilePosition = undefined;
    this.lastRenderedState = undefined;
    this.actionPending = false;
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
