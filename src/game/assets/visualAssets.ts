import Phaser from 'phaser';

export const VISUAL_TEXTURE_KEYS = Object.freeze({
  soilUntilled: 'visual-soil-untilled',
  soilTilled: 'visual-soil-tilled',
  soilWatered: 'visual-soil-watered',
  selectionCursor: 'visual-selection-cursor',
});

const GENERATED_ASSET_BASE = '/assets/generated';
const SVG_SIZE = Object.freeze({ width: 64, height: 64 });

export function preloadVisualAssets(scene: Phaser.Scene): void {
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.soilUntilled,
    `${GENERATED_ASSET_BASE}/soil-untilled.svg`,
    SVG_SIZE,
  );
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.soilTilled,
    `${GENERATED_ASSET_BASE}/soil-tilled.svg`,
    SVG_SIZE,
  );
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.soilWatered,
    `${GENERATED_ASSET_BASE}/soil-watered.svg`,
    SVG_SIZE,
  );
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.selectionCursor,
    `${GENERATED_ASSET_BASE}/selection-cursor.svg`,
    SVG_SIZE,
  );
}
