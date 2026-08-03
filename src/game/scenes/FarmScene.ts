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
import {
  requiredInteractionKind,
  resolveWorldInteractionTarget,
  type WorldInteractionTarget,
} from '../world/worldInteractionTarget';

const ACTION_KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.E,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
] as const;
const TILE_DISPLAY_SIZE = 58;
const TILE_SPACING = 64;
const CROP_STAGE_SIZE = 64;
const BED_TARGET_ID = 'world:bed';
const SHIPPING_BIN_TARGET_ID = 'world:shipping-bin';
const BED_POSITION = Object.freeze({ x: 800, y: 448 });
const SHIPPING_BIN_POSITION = Object.freeze({ x: 160, y: 448 });

let farmSceneCreateCount = 0;
let farmSceneShutdownCount = 0;

type FarmTileVisual = Readonly<{
  tileId: string;
  position: Phaser.Math.Vector2;
  soil: Phaser.GameObjects.Image;
  crop: Phaser.GameObjects.Image;
  selection: Phaser.GameObjects.Image;
}>;

type WorldObjectVisual = Readonly<{
  target: WorldInteractionTarget;
  image: Phaser.GameObjects.Image;
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

function guidedCropTileId(state: FarmLoopState): string | undefined {
  const cropTiles = state.field.tiles.filter((tile) => tile.crop !== null);
  return cropTiles.length === 1 ? cropTiles[0]?.id : undefined;
}

export class FarmScene extends Phaser.Scene {
  private playerController: PlayerController | undefined;
  private farmRuntime: FarmGameRuntime | undefined;
  private actionKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly farmTileVisuals = new Map<string, FarmTileVisual>();
  private readonly worldObjectVisuals = new Map<string, WorldObjectVisual>();
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
    this.createWorldInteractionObjects();

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

    this.game.canvas.dataset.visualAssetCount = '5';
    this.game.canvas.dataset.visualPrototype = 'authoritative-farm-grid';
    this.game.canvas.dataset.worldFarmTileId = TUTORIAL_TILE_ID;
    this.game.canvas.dataset.worldFarmTileCount = String(
      STARTER_FARM_TILE_DEFINITIONS.length,
    );
  }

  private createWorldInteractionObjects(): void {
    this.addWorldInteractionObject(
      Object.freeze({
        id: BED_TARGET_ID,
        kind: 'bed',
        x: BED_POSITION.x,
        y: BED_POSITION.y,
      }),
      VISUAL_TEXTURE_KEYS.worldBed,
    );
    this.addWorldInteractionObject(
      Object.freeze({
        id: SHIPPING_BIN_TARGET_ID,
        kind: 'shipping_bin',
        x: SHIPPING_BIN_POSITION.x,
        y: SHIPPING_BIN_POSITION.y,
      }),
      VISUAL_TEXTURE_KEYS.worldShippingBin,
    );
    this.game.canvas.dataset.worldInteractionObjectCount = String(
      this.worldObjectVisuals.size,
    );
  }

  private addWorldInteractionObject(
    target: WorldInteractionTarget,
    textureKey: string,
  ): void {
    const image = this.add
      .image(target.x, target.y, textureKey)
      .setDisplaySize(64, 64)
      .setDepth(target.y + 1);
    const selection = this.add
      .image(target.x, target.y, VISUAL_TEXTURE_KEYS.selectionCursor)
      .setDisplaySize(70, 70)
      .setAlpha(0.16)
      .setDepth(target.y + 2);
    this.worldObjectVisuals.set(
      target.id,
      Object.freeze({ target, image, selection }),
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
    const guidedTileId = guidedCropTileId(state);
    if (guidedTileId === undefined) {
      delete canvas.dataset.worldGuidedCropTileId;
    } else {
      canvas.dataset.worldGuidedCropTileId = guidedTileId;
    }
  }

  private interactionTargets(): readonly WorldInteractionTarget[] {
    const farmTargets = [...this.farmTileVisuals.values()].map((visual) =>
      Object.freeze({
        id: visual.tileId,
        kind: 'farm_tile' as const,
        x: visual.position.x,
        y: visual.position.y,
      }),
    );
    const objectTargets = [...this.worldObjectVisuals.values()].map(
      (visual) => visual.target,
    );
    return Object.freeze([...farmTargets, ...objectTargets]);
  }

  private resolveCurrentTarget(): WorldInteractionTarget | undefined {
    const player = this.playerController;
    if (player === undefined) {
      return undefined;
    }

    return resolveWorldInteractionTarget(
      {
        x: player.sprite.x,
        y: player.sprite.y,
        facing: player.getFacingDirection(),
      },
      this.interactionTargets(),
    );
  }

  private updateTargetFeedback(): void {
    const target = this.resolveCurrentTarget();
    for (const visual of this.farmTileVisuals.values()) {
      visual.selection.setAlpha(visual.tileId === target?.id ? 0.98 : 0.16);
    }
    for (const visual of this.worldObjectVisuals.values()) {
      visual.selection.setAlpha(visual.target.id === target?.id ? 0.98 : 0.16);
    }

    const action = recommendedAction(
      this.farmRuntime?.getState().tutorial.step ?? 'completed',
    );
    const actionReady =
      action !== undefined &&
      target !== undefined &&
      requiredInteractionKind(action) === target.kind;
    this.actionHint?.setVisible(actionReady);
    if (target !== undefined) {
      this.actionHint
        ?.setPosition(target.x, target.y - 46)
        .setDepth(target.y + 3);
    }

    const canvas = this.game.canvas;
    canvas.dataset.worldTargetReady = String(target !== undefined);
    canvas.dataset.worldActionReady = String(actionReady);
    if (target === undefined) {
      delete canvas.dataset.worldTargetId;
      delete canvas.dataset.worldTargetKind;
      this.clearTargetTileDataset();
      return;
    }

    canvas.dataset.worldTargetId = target.id;
    canvas.dataset.worldTargetKind = target.kind;
    if (target.kind !== 'farm_tile') {
      this.clearTargetTileDataset();
      return;
    }

    canvas.dataset.worldTargetTileId = target.id;
    const runtime = this.farmRuntime;
    const targetTile =
      runtime === undefined
        ? undefined
        : getFarmTile(runtime.getState().field, target.id);
    if (targetTile !== undefined) {
      canvas.dataset.worldTargetSoil = targetTile.soil;
      canvas.dataset.worldTargetWatered = String(targetTile.watered);
      canvas.dataset.worldTargetCropStage =
        targetTile.crop === null
          ? 'none'
          : String(targetTile.crop.growthStageIndex);
    }
  }

  private clearTargetTileDataset(): void {
    const canvas = this.game.canvas;
    delete canvas.dataset.worldTargetTileId;
    delete canvas.dataset.worldTargetSoil;
    delete canvas.dataset.worldTargetWatered;
    delete canvas.dataset.worldTargetCropStage;
  }

  private domainTileIdForAction(
    action: FarmLoopTutorialAction,
    target: WorldInteractionTarget,
    state: FarmLoopState,
  ): string | undefined {
    if (target.kind === 'farm_tile') {
      return target.id;
    }
    if (action === 'next_day') {
      return guidedCropTileId(state);
    }
    if (action === 'sell') {
      return TUTORIAL_TILE_ID;
    }
    return undefined;
  }

  private async performRecommendedAction(): Promise<void> {
    const runtime = this.farmRuntime;
    const target = this.resolveCurrentTarget();
    if (runtime === undefined || target === undefined) {
      return;
    }

    const state = runtime.getState();
    const action = recommendedAction(state.tutorial.step);
    if (
      action === undefined ||
      requiredInteractionKind(action) !== target.kind
    ) {
      return;
    }
    const domainTileId = this.domainTileIdForAction(action, target, state);
    if (domainTileId === undefined) {
      return;
    }

    this.actionPending = true;
    this.game.canvas.dataset.worldActionPending = 'true';
    try {
      const result = await runtime.perform(action, domainTileId);
      const canvas = this.game.canvas;
      canvas.dataset.worldLastAction = action;
      canvas.dataset.worldLastInteractionId = target.id;
      canvas.dataset.worldLastInteractionKind = target.kind;
      if (action === 'sell') {
        delete canvas.dataset.worldLastActionTileId;
      } else {
        canvas.dataset.worldLastActionTileId = domainTileId;
      }
      canvas.dataset.worldLastResult = result.status;
      if ('code' in result) {
        canvas.dataset.worldLastFailure = result.code;
      } else {
        delete canvas.dataset.worldLastFailure;
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
    this.worldObjectVisuals.clear();
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
