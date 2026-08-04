import Phaser from 'phaser';
import {
  isMoving,
  type FacingDirection,
  resolveFacingDirection,
  resolveMovementVector,
} from '../../domain/player/movement';
import {
  getPlayerFrameAddress,
  PLAYER_ANIMATIONS,
  PLAYER_BODY,
  PLAYER_FOOT_Y,
  PLAYER_ORIGIN,
  type PlayerAnimationId,
} from '../assets/artPackContract';
import {
  getPlayerAnimationKey,
  RUNTIME_ART_TEXTURE_KEYS,
} from '../assets/runtimeArtPack';
import {
  advancePlayerAnimationTimeline,
  createPlayerAnimationTimeline,
  type PlayerAnimationTimelineState,
} from './playerAnimationTimeline';

const PLAYER_SPEED = 150;
const DEFAULT_AUTO_MOVE_ARRIVAL_THRESHOLD = 5;
const DEFAULT_AUTO_MOVE_TIMEOUT_MS = 8_000;

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

export type PlayerActionImpact = () => Promise<void>;

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

type ActiveAction = {
  animationId: PlayerAnimationId;
  timeline: PlayerAnimationTimelineState;
  impactSettled: boolean;
  visualCompleted: boolean;
  onImpact: PlayerActionImpact;
  resolve: (completed: boolean) => void;
  reject: (reason: unknown) => void;
};

function prefersReducedMotion(): boolean {
  return (
    (typeof document !== 'undefined' &&
      document.documentElement.dataset.reducedMotion === 'true') ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
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
  private autoMove: ActiveAutoMove | undefined;
  private activeAction: ActiveAction | undefined;
  private actionImpactDispatchCount = 0;
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
      .ellipse(options.spawnX, options.spawnY - 3, 28, 10, 0x355f36, 0.22)
      .setDepth(options.spawnY - 1);

    const initialFrame = getPlayerFrameAddress('player.idle', this.facing, 0);
    this.sprite = scene.physics.add
      .sprite(
        options.spawnX,
        options.spawnY,
        RUNTIME_ART_TEXTURE_KEYS.player,
        initialFrame.stableFrameKey,
      )
      .setOrigin(PLAYER_ORIGIN.x, PLAYER_ORIGIN.y)
      .setBodySize(PLAYER_BODY.width, PLAYER_BODY.height, false)
      .setOffset(PLAYER_BODY.offsetX, PLAYER_BODY.offsetY)
      .setCollideWorldBounds(true)
      .setDepth(options.spawnY);

    this.sprite.setPushable(false);
    this.playLocomotionAnimation('player.idle');

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
    if (this.destroyed || this.activeAction !== undefined) {
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
    if (this.activeAction === undefined) {
      this.playLocomotionAnimation('player.idle');
    }
    this.writeDebugState();
  }

  public async playActionAnimation(
    animationId: PlayerAnimationId,
    onImpact: PlayerActionImpact,
  ): Promise<boolean> {
    const animation = PLAYER_ANIMATIONS[animationId];
    if (
      this.destroyed ||
      this.activeAction !== undefined ||
      animation.impactFrameIndex === null
    ) {
      return false;
    }

    this.cancelAutoMove('replaced');
    this.sprite.setVelocity(0, 0);

    if (prefersReducedMotion()) {
      const impactFrameIndex = animation.impactFrameIndex;
      this.sprite.anims.stop();
      this.sprite.setFrame(
        getPlayerFrameAddress(animationId, this.facing, impactFrameIndex)
          .stableFrameKey,
      );
      this.actionImpactDispatchCount += 1;
      this.writeDebugState(animationId);
      await onImpact();
      if (this.canResumeAfterAction()) {
        this.playLocomotionAnimation('player.idle');
        this.writeDebugState();
      }
      return this.canResumeAfterAction();
    }

    const result = new Promise<boolean>((resolve, reject) => {
      this.activeAction = {
        animationId,
        timeline: createPlayerAnimationTimeline(animationId),
        impactSettled: false,
        visualCompleted: false,
        onImpact,
        resolve,
        reject,
      };
    });
    this.sprite.play(getPlayerAnimationKey(animationId, this.facing), true);
    this.writeDebugState(animationId);
    return result;
  }

  public update(deltaMs: number): void {
    if (this.destroyed) {
      return;
    }

    if (this.activeAction !== undefined) {
      this.updateActiveAction(deltaMs);
      this.updateDepthAndShadow();
      this.writeDebugState();
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

    const movement =
      !manualMoving && this.autoMove !== undefined
        ? this.resolveAutoMovement(deltaMs)
        : manualMovement;
    const moving = isMoving(movement);
    const nextFacing = resolveFacingDirection(movement, this.facing);
    const facingChanged = nextFacing !== this.facing;
    this.facing = nextFacing;
    this.sprite.setVelocity(
      movement.x * PLAYER_SPEED,
      movement.y * PLAYER_SPEED,
    );

    const locomotionAnimation: PlayerAnimationId = moving
      ? 'player.walk'
      : 'player.idle';
    if (
      facingChanged ||
      this.sprite.anims.currentAnim?.key !==
        getPlayerAnimationKey(locomotionAnimation, this.facing)
    ) {
      this.playLocomotionAnimation(locomotionAnimation);
    }

    this.updateDepthAndShadow();
    this.writeDebugState();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.cancelAutoMove('destroyed');
    this.restartKey.off('down', this.handleRestart);
    this.sprite.anims.stop();
    const activeAction = this.activeAction;
    this.activeAction = undefined;
    activeAction?.resolve(false);
    activeControllerCount -= 1;
    this.scene.game.canvas.dataset.activePlayerControllers = String(
      activeControllerCount,
    );
  }

  private canResumeAfterAction(): boolean {
    return !this.destroyed;
  }

  private playLocomotionAnimation(animationId: 'player.idle' | 'player.walk'): void {
    this.sprite.play(getPlayerAnimationKey(animationId, this.facing), true);
  }

  private updateActiveAction(deltaMs: number): void {
    const active = this.activeAction;
    if (active === undefined) {
      return;
    }

    const advance = advancePlayerAnimationTimeline(active.timeline, deltaMs);
    active.timeline = advance.state;
    active.visualCompleted = advance.state.completed;

    if (advance.impactDue) {
      this.actionImpactDispatchCount += 1;
      this.writeDebugState(active.animationId);
      void active.onImpact().then(
        () => {
          if (this.activeAction !== active) {
            return;
          }
          active.impactSettled = true;
          this.finishActiveActionIfReady(active);
        },
        (reason: unknown) => {
          if (this.activeAction !== active) {
            return;
          }
          this.activeAction = undefined;
          this.playLocomotionAnimation('player.idle');
          active.reject(reason);
          this.writeDebugState();
        },
      );
    }

    this.finishActiveActionIfReady(active);
  }

  private finishActiveActionIfReady(active: ActiveAction): void {
    if (
      this.activeAction !== active ||
      !active.visualCompleted ||
      !active.impactSettled
    ) {
      return;
    }

    this.activeAction = undefined;
    this.playLocomotionAnimation('player.idle');
    active.resolve(true);
    this.writeDebugState();
  }

  private updateDepthAndShadow(): void {
    this.sprite.setDepth(Math.round(this.sprite.y));
    this.shadow
      .setPosition(this.sprite.x, this.sprite.y - 3)
      .setDepth(Math.round(this.sprite.y) - 1);
  }

  private resolveAutoMovement(
    deltaMs: number,
  ): Readonly<{ x: number; y: number }> {
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

  private writeDebugState(actionAnimationId?: PlayerAnimationId): void {
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
    canvas.dataset.playerActionAnimating = String(
      this.activeAction !== undefined,
    );
    canvas.dataset.playerTextureKey = this.sprite.texture.key;
    canvas.dataset.playerFrameKey = this.sprite.frame.name;
    canvas.dataset.playerAnimationKey =
      this.sprite.anims.currentAnim?.key ?? 'none';
    canvas.dataset.playerOrigin = `${this.sprite.originX.toFixed(2)},${this.sprite.originY.toFixed(2)}`;
    canvas.dataset.playerBody = `${String(PLAYER_BODY.width)}x${String(PLAYER_BODY.height)}@${String(PLAYER_BODY.offsetX)},${String(PLAYER_BODY.offsetY)}`;
    canvas.dataset.playerFootY = String(PLAYER_FOOT_Y);
    canvas.dataset.playerDepth = String(this.sprite.depth);
    canvas.dataset.playerActionImpactDispatchCount = String(
      this.actionImpactDispatchCount,
    );
    const effectiveActionAnimationId =
      actionAnimationId ?? this.activeAction?.animationId;
    if (effectiveActionAnimationId === undefined) {
      delete canvas.dataset.playerActionAnimationId;
    } else {
      canvas.dataset.playerActionAnimationId = effectiveActionAnimationId;
    }
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
