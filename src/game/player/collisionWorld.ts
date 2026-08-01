import Phaser from 'phaser';
import type { FarmMapRegion } from '../../data/maps/farmMapContract';

type StaticCollisionRectangle = Phaser.GameObjects.Rectangle & {
  body: Phaser.Physics.Arcade.StaticBody;
};

export type PlayerCollisionWorld = Readonly<{
  destroy: () => void;
}>;

export function createPlayerCollisionWorld(
  scene: Phaser.Scene,
  player: Phaser.Physics.Arcade.Sprite,
  regions: readonly FarmMapRegion[],
): PlayerCollisionWorld {
  const rectangles: StaticCollisionRectangle[] = [];
  const colliders: Phaser.Physics.Arcade.Collider[] = [];

  for (const region of regions) {
    const rectangle = scene.add
      .rectangle(
        region.x + region.width / 2,
        region.y + region.height / 2,
        region.width,
        region.height,
        0x2b4b2d,
        0.08,
      )
      .setDepth(9);

    scene.physics.add.existing(rectangle, true);

    const staticRectangle = rectangle as StaticCollisionRectangle;
    rectangles.push(staticRectangle);
    colliders.push(scene.physics.add.collider(player, staticRectangle));
  }

  return {
    destroy: () => {
      for (const collider of colliders) {
        collider.destroy();
      }

      for (const rectangle of rectangles) {
        rectangle.destroy();
      }
    },
  };
}
