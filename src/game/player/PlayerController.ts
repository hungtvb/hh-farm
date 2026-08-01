import Phaser from 'phaser';
import {
  isMoving,
  type FacingDirection,
  resolveFacingDirection,
  resolveMovementVector,
} from '../../domain/player/movement';
import { getPlayerTextureKey } from './createPlayerTextures';

const PLAYER_SPEED = 150;
const WALK_FRAME_DURATION_MS = 130;
const PLAYER_BODY_WIDTH = 18;
const PLAYER_BODY_HEIGHT = 12;
const PLAYER_BODY_OFFSET_X = 7;
const PLAYER_BODY_OFFSET_Y = 35;

let activeControllerCount = 0;

export type PlayerControllerOptions = Readonly<{
  sceneInstance: number;
  spawnX: number;
  spawnY: number;
}>;

export class PlayerController {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;

  private readonly scene: Phaser.Scene;
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wKey: Phaser.Input.Keyboard.Key;
  private readonly aKey: Phaser.Input.Keyboard.Key;
  private readonly sKey: Phaser.Input.Keyboard.Key;
  private readonly dKey: Phaser.Input.Keyboard.Key;
  private readonly restartKey: Phaser.Input.Keyboard.Key;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly sceneInstance: number;

  private facing: FacingDirection = 'down';
  private walkElapsedMs = 0;
  private walkFrame: 'walk-a' | 'walk-b' = 'walk-a';
  private destroyed = false;

  public constructor(scene: Phaser.Scene, options: PlayerControllerOptions) {
    this.scene = scene;
    this.sceneInstance = options.sceneInstance;

    if (scene.input.keyboard === null) {
      throw new Error('Keyboard input is required for the player prototype.');
    }

    this.keyboard = scene.input.keyboard;
    this.cursors = this.keyboard.createCursorKeys();
    this.wKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.sKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.dKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.restartKey = this.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    this.shadow = scene.add
      .ellipse(options.spawnX, options.spawnY - 3, 24, 10, 0x355f36, 0.22)
      .setDepth(options.spawnY - 1);

    this.sprite = scene.physics.add
      .sprite(
        options.spawnX,
        options.spawnY,
        getPlayerTextureKey(this.facing, 'idle'),
      )
      .setOrigin(0.5, 1)
      .setBodySize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, false)
      .setOffset(PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y)
      .setCollideWorldBounds(true)
      .setDepth(options.spawnY);

    this.sprite.setPushable(false);

    activeControllerCount += 1;
    this.writeDebugState();
  }

  public update(deltaMs: number): void {
    if (this.destroyed) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.scene.restart();
      return;
    }

    const movement = resolveMovementVector({
      left: this.cursors.left.isDown || this.aKey.isDown,
      right: this.cursors.right.isDown || this.dKey.isDown,
      up: this.cursors.up.isDown || this.wKey.isDown,
      down: this.cursors.down.isDown || this.sKey.isDown,
    });
    const moving = isMoving(movement);

    this.facing = resolveFacingDirection(movement, this.facing);
    this.sprite.setVelocity(
      movement.x * PLAYER_SPEED,
      movement.y * PLAYER_SPEED,
    );

    if (moving) {
      this.walkElapsedMs += deltaMs;

      if (this.walkElapsedMs >= WALK_FRAME_DURATION_MS) {
        this.walkElapsedMs %= WALK_FRAME_DURATION_MS;
        this.walkFrame = this.walkFrame === 'walk-a' ? 'walk-b' : 'walk-a';
      }

      this.sprite.setTexture(getPlayerTextureKey(this.facing, this.walkFrame));
    } else {
      this.walkElapsedMs = 0;
      this.walkFrame = 'walk-a';
      this.sprite.setTexture(getPlayerTextureKey(this.facing, 'idle'));
    }

    this.sprite.setDepth(Math.round(this.sprite.y));
    this.shadow
      .setPosition(this.sprite.x, this.sprite.y - 3)
      .setDepth(Math.round(this.sprite.y) - 1);

    this.writeDebugState();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.sprite.setVelocity(0, 0);
    this.scene.cameras.main.stopFollow();

    for (const key of [
      this.cursors.left,
      this.cursors.right,
      this.cursors.up,
      this.cursors.down,
      this.wKey,
      this.aKey,
      this.sKey,
      this.dKey,
      this.restartKey,
    ]) {
      this.keyboard.removeKey(key);
    }

    this.shadow.destroy();
    this.sprite.destroy();
    activeControllerCount -= 1;
    this.writeDebugState();
  }

  private writeDebugState(): void {
    const { canvas } = this.scene.game;
    const { main: camera } = this.scene.cameras;
    const body = this.sprite.body;

    canvas.dataset.sceneInstance = String(this.sceneInstance);
    canvas.dataset.activePlayerControllers = String(activeControllerCount);
    canvas.dataset.playerX = this.sprite.x.toFixed(2);
    canvas.dataset.playerY = this.sprite.y.toFixed(2);
    canvas.dataset.playerVelocityX = body.velocity.x.toFixed(2);
    canvas.dataset.playerVelocityY = body.velocity.y.toFixed(2);
    canvas.dataset.playerFacing = this.facing;
    canvas.dataset.cameraX = camera.scrollX.toFixed(2);
    canvas.dataset.cameraY = camera.scrollY.toFixed(2);
  }
}
