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
const DEFAULT_AUTO_MOVE_ARRIVAL_THRESHOLD = 5;
const DEFAULT_AUTO_MOVE_TIMEOUT_MS = 8_000;
const ACTION_TWEEN_DURATION_MS = 90;

let activeControllerCount = 0;
let restartRequestCount = 0;

export type PlayerControllerOptions = Readonly<{
  sceneInstance: number;
  spawnX: number;
  spawnY: number;
}>;

export type PlayerAutoMoveCancelReason =
  | 'destroyed'
  | 'manual_input'
  | 'replaced'
  | 'timeout';

export type PlayerAutoMoveRequest = Readonly<{
  x: number;
  y: number;
  facingOnArrival: FacingDirection;
  arrivalThreshold?: number;
  timeoutMs?: number;
  onArrive?: () => void;
  onCancel?: (reason: PlayerAutoMoveCancelReason) => void;
}>;

type ActiveAutoMove = Readonly<{
  x: number;
  y: number;
  facingOnArrival: FacingDirection;
  arrivalThreshold: number;
  timeoutMs: number;
  onArrive: (() => void) | undefined;
  onCancel: ((reason: PlayerAutoMoveCancelReason) => void) | undefined;
}> & {
  elapsedMs: number;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

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
  private autoMove: ActiveAutoMove | undefined;
  private actionAnimating = false;
  private destroyed = false;

  private readonly handleRestart = (): void => {
    if (this.destroyed) {
      return;
    }

    restartRequestCount += 1;
    this.scene.game.canvas.dataset.restartRequestCount = String(
      restartRequestCount,
    );
    this.scene.scene.restart();
  };

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
    this.restartKey.on('down', this.handleRestart);

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

  public getFacingDirection(): FacingDirection {
    return this.facing;
  }

  public isAutoMoving(): boolean {
    return this.autoMove !== undefined;
  }

  public moveTo(request: PlayerAutoMoveRequest): void {
    if (this.destroyed) {
      return;
    }

    this.cancelAutoMove('replaced');
    this.autoMove = {
      x: request.x,
      y: request.y,
      facingOnArrival: request.facingOnArrival,
      arrivalThreshold:
        request.arrivalThreshold ?? DEFAULT_AUTO_MOVE_ARRIVAL_THRESHOLD,
      timeoutMs: request.timeoutMs ?? DEFAULT_AUTO_MOVE_TIMEOUT_MS,
      onArrive: request.onArrive,
      onCancel: request.onCancel,
      elapsedMs: 0,
    };
    this.writeDebugState();
  }

  public cancelAutoMove(
    reason: PlayerAutoMoveCancelReason = 'replaced',
  ): void {
    const active = this.autoMove;
    if (active === undefined) {
      return;
    }

    this.autoMove = undefined;
    this.sprite.setVelocity(0, 0);
    active.onCancel?.(reason);
    this.writeDebugState();
  }

  public setFacingDirection(facing: FacingDirection): void {
    this.facing = facing;
    this.sprite.setTexture(getPlayerTextureKey(this.facing, 'idle'));
    this.writeDebugState();
  }

  public async playActionAnimation(): Promise<void> {
    if (this.destroyed || this.actionAnimating) {
      return;
    }

    this.actionAnimating = true;
    this.sprite.setVelocity(0, 0);
    this.writeDebugState();

    try {
      if (prefersReducedMotion()) {
        return;
      }

      await new Promise<void>((resolve) => {
        this.scene.tweens.add({
          targets: this.sprite,
          scaleX: 1.08,
          scaleY: 0.9,
          duration: ACTION_TWEEN_DURATION_MS,
          ease: 'Sine.easeInOut',
          yoyo: true,
          onComplete: () => {
            resolve();
          },
          onStop: () => {
            resolve();
          },
        });
      });
    } finally {
      this.sprite.setScale(1);
      this.actionAnimating = false;
      this.writeDebugState();
    }
  }

  public update(deltaMs: number): void {
    if (this.destroyed) {
      return;
    }

    const manualMovement = resolveMovementVector({
      left: this.cursors.left.isDown || this.aKey.isDown,
      right: this.cursors.right.isDown || this.dKey.isDown,
      up: this.cursors.up.isDown || this.wKey.isDown,
      down: this.cursors.down.isDown || this.sKey.isDown,
    });
    const manualMoving = isMoving(manualMovement);

    if (manualMoving && this.autoMove !== undefined) {
      this.cancelAutoMove('manual_input');
    }

    let movement = manualMovement;
    if (this.actionAnimating) {
      movement = { x: 0, y: 0 };
    } else if (!manualMoving && this.autoMove !== undefined) {
      movement = this.resolveAutoMovement(deltaMs);
    }

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
    this.cancelAutoMove('destroyed');
    this.restartKey.off('down', this.handleRestart);
    this.scene.tweens.killTweensOf(this.sprite);
    activeControllerCount -= 1;
    this.scene.game.canvas.dataset.activePlayerControllers = String(
      activeControllerCount,
    );
  }

  private resolveAutoMovement(deltaMs: number): Readonly<{ x: number; y: number }> {
    const active = this.autoMove;
    if (active === undefined) {
      return { x: 0, y: 0 };
    }

    active.elapsedMs += deltaMs;
    const dx = active.x - this.sprite.x;
    const dy = active.y - this.sprite.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= active.arrivalThreshold) {
      this.autoMove = undefined;
      this.facing = active.facingOnArrival;
      active.onArrive?.();
      return { x: 0, y: 0 };
    }

    if (active.elapsedMs >= active.timeoutMs) {
      this.cancelAutoMove('timeout');
      return { x: 0, y: 0 };
    }

    return Object.freeze({
      x: dx / distance,
      y: dy / distance,
    });
  }

  private writeDebugState(): void {
    const { canvas } = this.scene.game;
    const { main: camera } = this.scene.cameras;
    const body = this.sprite.body;

    if (body === null) {
      throw new Error('Player sprite is missing its Arcade Physics body.');
    }

    canvas.dataset.sceneInstance = String(this.sceneInstance);
    canvas.dataset.activePlayerControllers = String(activeControllerCount);
    canvas.dataset.restartRequestCount = String(restartRequestCount);
    canvas.dataset.playerX = this.sprite.x.toFixed(2);
    canvas.dataset.playerY = this.sprite.y.toFixed(2);
    canvas.dataset.playerVelocityX = body.velocity.x.toFixed(2);
    canvas.dataset.playerVelocityY = body.velocity.y.toFixed(2);
    canvas.dataset.playerFacing = this.facing;
    canvas.dataset.playerAutoMoving = String(this.autoMove !== undefined);
    canvas.dataset.playerActionAnimating = String(this.actionAnimating);
    if (this.autoMove === undefined) {
      delete canvas.dataset.playerAutoTargetX;
      delete canvas.dataset.playerAutoTargetY;
    } else {
      canvas.dataset.playerAutoTargetX = this.autoMove.x.toFixed(2);
      canvas.dataset.playerAutoTargetY = this.autoMove.y.toFixed(2);
    }
    canvas.dataset.cameraX = camera.scrollX.toFixed(2);
    canvas.dataset.cameraY = camera.scrollY.toFixed(2);
  }
}
