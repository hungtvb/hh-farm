import Phaser from 'phaser';
import type { FarmLoopTutorialAction } from '../../application/farmLoop/farmLoopCoordinator';
import {
  STARTER_FARM_TILE_DEFINITIONS,
  TUTORIAL_TILE_ID,
  type FarmLoopState,
} from '../../application/farmLoop/farmLoopState';
import {
  getFarmTile,
  type FarmTileState,
} from '../../domain/farming/farmTileState';
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
const TARGET_FORWARD_TOLERANCE = 24;
const TILE_DISPLAY_SIZE = 58;
const TILE_SPACING = 64;
const CROP_STAGE_SIZE = 64;

let farmSceneCreateCount = 0;
let farmSceneShutdownCount = 0;

type FarmTileVisual = Readonly<{
  tileId: string;
  position: Phaser.Math.Vector2;
  soil: Phaser.GameObjects.Image;
  crop: Phaser.GameObjects.Image;
  selection: Phaser.GameObjects.Image;
}>;

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

function soilTextureFor(tile: FarmTileState): string {
  if (tile.watered) {
    return VISUAL_TEXTURE_KEYS.soilWatered;
  }

  return tile.soil === 'tilled'
    ? VISUAL_TEXTURE_KEYS.soilTilled
    : VISUAL_TEXTURE_KEYS.soilUntilled;
}

export class FarmScene extends Phaser.Scene {
  private playerController: PlayerController | undefined;
  private farmRuntime: FarmGameRuntime | undefined;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly farmTileVisuals = new Map<string, FarmTileVisual>();
  private actionHint: Phaser.GameObjects.Text | undefined;
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

    const tutorialTilePosition = new Phaser.Math.Vector2(
      farmableRegion.x + farmableRegion.width / 2,
      farmableRegion.y + farmableRegion.height - 32,
    );
    this.createAuthoritativeFarmGrid(tutorialTilePosition);

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

  private createAuthoritativeFarmGrid(
    tutorialTilePosition: Phaser.Math.Vector2,
  ): void {
    for (const definition of STARTER_FARM_TILE_DEFINITIONS) {
      const position = new Phaser.Math.Vector2(
        tutorialTilePosition.x + definition.x * TILE_SPACING,
        tutorialTilePosition.y + definition.y * TILE_SPACING,
      );
      const soil = this.add
        .image(position.x, position.y, VISUAL_TEXTURE_KEYS.soilUntilled)
        .setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE)
        .setDepth(position.y);
      const crop = this.add
        .image(position.x, position.y, VISUAL_TEXTURE_KEYS.cropTurnipStages)
        .setCrop(0, 0, CROP_STAGE_SIZE, CROP_STAGE_SIZE)
        .setDisplaySize(TILE_DISPLAY_SIZE, TILE_DISPLAY_SIZE)
        .setDepth(position.y + 1)
        .setVisible(false);
      const selection = this.add
        .image(position.x, position.y, VISUAL_TEXTURE_KEYS.selectionCursor)
        .setDisplaySize(62, 62)
        .setAlpha(0.16)
        .setDepth(position.y + 2);

      this.farmTileVisuals.set(
        definition.id,
        Object.freeze({
          tileId: definition.id,
          position,
          soil,
          crop,
          selection,
        }),
      );
    }

    this.actionHint = this.add
      .text(tutorialTilePosition.x, tutorialTilePosition.y - 46, 'E', {
        color: '#1f3b28',
        backgroundColor: '#fff8dc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(tutorialTilePosition.y + 3)
      .setVisible(false);

    this.game.canvas.dataset.visualAssetCount = '3';
    this.game.canvas.dataset.visualPrototype = 'authoritative-farm-grid';
    this.game.canvas.dataset.worldFarmTileId = TUTORIAL_TILE_ID;
    this.game.canvas.dataset.worldFarmTileCount = String(
      STARTER_FARM_TILE_DEFINITIONS.length,
    );
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

    for (const [tileId, visual] of this.farmTileVisuals) {
      const tile = getFarmTile(state.field, tileId);
      if (tile === undefined) {
        throw new Error(`Missing authoritative tile "${tileId}".`);
      }

      visual.soil.setTexture(soilTextureFor(tile));
      if (tile.crop === null) {
        visual.crop.setVisible(false);
      } else {
        visual.crop
          .setCrop(
            Math.min(tile.crop.growthStageIndex, 3) * CROP_STAGE_SIZE,
            0,
            CROP_STAGE_SIZE,
            CROP_STAGE_SIZE,
          )
          .setVisible(true);
      }
    }

    const tutorialTile = getFarmTile(state.field, TUTORIAL_TILE_ID);
    if (tutorialTile === undefined) {
      throw new Error(`Missing authoritative tile "${TUTORIAL_TILE_ID}".`);
    }

    const canvas = this.game.canvas;
    canvas.dataset.worldSoil = tutorialTile.soil;
    canvas.dataset.worldWatered = String(tutorialTile.watered);
    canvas.dataset.worldCropStage =
      tutorialTile.crop === null
        ? 'none'
        : String(tutorialTile.crop.growthStageIndex);
    canvas.dataset.worldTutorialStep = state.tutorial.step;
    canvas.dataset.worldDay = String(state.farm.day);
    canvas.dataset.worldCoins = String(state.economy.wallet.coins);
    canvas.dataset.worldTilledTileCount = String(
      state.field.tiles.filter((tile) => tile.soil === 'tilled').length,
    );
    canvas.dataset.worldCropTileCount = String(
      state.field.tiles.filter((tile) => tile.crop !== null).length,
    );
  }

  private updateTargetFeedback(): void {
    const targetTileId = this.resolveTargetedFarmTileId();
    for (const visual of this.farmTileVisuals.values()) {
      visual.selection.setAlpha(visual.tileId === targetTileId ? 0.98 : 0.16);
    }

    const action = recommendedAction(
      this.farmRuntime?.getState().tutorial.step ?? 'completed',
    );
    const targetVisual =
      targetTileId === undefined
        ? undefined
        : this.farmTileVisuals.get(targetTileId);
    this.actionHint?.setVisible(
      targetVisual !== undefined && action !== undefined,
    );
    if (targetVisual !== undefined) {
      this.actionHint
        ?.setPosition(targetVisual.position.x, targetVisual.position.y - 46)
        .setDepth(targetVisual.position.y + 3);
    }

    const canvas = this.game.canvas;
    canvas.dataset.worldTargetReady = String(targetTileId !== undefined);
    if (targetTileId === undefined) {
      delete canvas.dataset.worldTargetTileId;
      delete canvas.dataset.worldTargetSoil;
      delete canvas.dataset.worldTargetWatered;
      delete canvas.dataset.worldTargetCropStage;
      return;
    }

    canvas.dataset.worldTargetTileId = targetTileId;
    const runtime = this.farmRuntime;
    const targetTile =
      runtime === undefined
        ? undefined
        : getFarmTile(runtime.getState().field, targetTileId);
    if (targetTile !== undefined) {
      canvas.dataset.worldTargetSoil = targetTile.soil;
      canvas.dataset.worldTargetWatered = String(targetTile.watered);
      canvas.dataset.worldTargetCropStage =
        targetTile.crop === null
          ? 'none'
          : String(targetTile.crop.growthStageIndex);
    }
  }

  private resolveTargetedFarmTileId(): string | undefined {
    const player = this.playerController;
    if (player === undefined) {
      return undefined;
    }

    const facing = player.getFacingDirection();
    let closest:
      | Readonly<{ tileId: string; distance: number }>
      | undefined;

    for (const visual of this.farmTileVisuals.values()) {
      const dx = visual.position.x - player.sprite.x;
      const dy = visual.position.y - player.sprite.y;
      const distance = Math.hypot(dx, dy);
      if (
        distance > TARGET_DISTANCE ||
        !this.isInsideFacingLane(dx, dy, facing)
      ) {
        continue;
      }

      if (closest === undefined || distance < closest.distance) {
        closest = Object.freeze({ tileId: visual.tileId, distance });
      }
    }

    return closest?.tileId;
  }

  private isInsideFacingLane(
    dx: number,
    dy: number,
    facing: ReturnType<PlayerController['getFacingDirection']>,
  ): boolean {
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
    const targetTileId = this.resolveTargetedFarmTileId();
    if (runtime === undefined || targetTileId === undefined) {
      return;
    }

    const action = recommendedAction(runtime.getState().tutorial.step);
    if (action === undefined) {
      return;
    }

    this.actionPending = true;
    this.game.canvas.dataset.worldActionPending = 'true';
    try {
      const result = await runtime.perform(action, targetTileId);
      this.game.canvas.dataset.worldLastAction = action;
      this.game.canvas.dataset.worldLastActionTileId = targetTileId;
      this.game.canvas.dataset.worldLastResult = result.status;
      if ('code' in result) {
        this.game.canvas.dataset.worldLastFailure = result.code;
      } else {
        delete this.game.canvas.dataset.worldLastFailure;
      }
      this.renderFarmState(true);
      this.updateTargetFeedback();
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
    this.farmTileVisuals.clear();
    this.actionHint = undefined;
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
