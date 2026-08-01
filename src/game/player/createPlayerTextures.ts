import Phaser from 'phaser';
import type { FacingDirection } from '../../domain/player/movement';

export type PlayerFrame = 'idle' | 'walk-a' | 'walk-b';

const TEXTURE_WIDTH = 32;
const TEXTURE_HEIGHT = 48;
const DIRECTIONS: readonly FacingDirection[] = [
  'down',
  'left',
  'right',
  'up',
];
const FRAMES: readonly PlayerFrame[] = ['idle', 'walk-a', 'walk-b'];

export function getPlayerTextureKey(
  direction: FacingDirection,
  frame: PlayerFrame,
): string {
  return `player-${direction}-${frame}`;
}

function drawFace(
  graphics: Phaser.GameObjects.Graphics,
  direction: FacingDirection,
): void {
  graphics.fillStyle(0x3f3329, 1);

  if (direction === 'down') {
    graphics.fillCircle(12, 13, 1.5);
    graphics.fillCircle(20, 13, 1.5);
  } else if (direction === 'left') {
    graphics.fillCircle(11, 13, 1.5);
  } else if (direction === 'right') {
    graphics.fillCircle(21, 13, 1.5);
  }
}

function drawPlayerFrame(
  graphics: Phaser.GameObjects.Graphics,
  direction: FacingDirection,
  frame: PlayerFrame,
): void {
  const bob = frame === 'idle' ? 0 : 1;
  const leftBootOffset = frame === 'walk-a' ? -2 : frame === 'walk-b' ? 2 : 0;
  const rightBootOffset = -leftBootOffset;

  graphics.clear();

  graphics.fillStyle(0x4c3428, 1);
  graphics.fillRoundedRect(7, 36 + leftBootOffset, 8, 10, 3);
  graphics.fillRoundedRect(17, 36 + rightBootOffset, 8, 10, 3);

  graphics.fillStyle(0x6ca65b, 1);
  graphics.fillRoundedRect(7, 20 + bob, 18, 19, 6);

  graphics.fillStyle(0xf1c8a4, 1);
  graphics.fillCircle(16, 12 + bob, 10);

  graphics.fillStyle(0x6b432c, 1);
  graphics.fillRoundedRect(7, 3 + bob, 18, 7, 4);
  graphics.fillCircle(9, 10 + bob, 4);
  graphics.fillCircle(23, 10 + bob, 4);

  drawFace(graphics, direction);

  graphics.fillStyle(0xe6b845, 1);
  if (direction === 'left') {
    graphics.fillTriangle(5, 24 + bob, 10, 21 + bob, 10, 28 + bob);
  } else if (direction === 'right') {
    graphics.fillTriangle(27, 24 + bob, 22, 21 + bob, 22, 28 + bob);
  } else if (direction === 'up') {
    graphics.fillRoundedRect(12, 22 + bob, 8, 5, 2);
  } else {
    graphics.fillRoundedRect(12, 29 + bob, 8, 5, 2);
  }
}

export function createPlayerTextures(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics().setVisible(false);

  for (const direction of DIRECTIONS) {
    for (const frame of FRAMES) {
      const key = getPlayerTextureKey(direction, frame);

      if (scene.textures.exists(key)) {
        continue;
      }

      drawPlayerFrame(graphics, direction, frame);
      graphics.generateTexture(key, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    }
  }

  graphics.destroy();
}
