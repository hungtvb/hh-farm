import Phaser from 'phaser';

export const VISUAL_TEXTURE_KEYS = Object.freeze({
  soilUntilled: 'visual-soil-untilled',
  soilTilled: 'visual-soil-tilled',
  soilWatered: 'visual-soil-watered',
  selectionCursor: 'visual-selection-cursor',
  cropTurnipStages: 'visual-crop-turnip-stages',
  worldBed: 'visual-world-bed',
  worldShippingBin: 'visual-world-shipping-bin',
});

const GENERATED_ASSET_BASE = '/assets/generated';
const SVG_SIZE = Object.freeze({ width: 64, height: 64 });
const CROP_STAGE_SHEET_SIZE = Object.freeze({ width: 256, height: 64 });

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
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.cropTurnipStages,
    `${GENERATED_ASSET_BASE}/crop-turnip.svg`,
    CROP_STAGE_SHEET_SIZE,
  );
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.worldBed,
    `${GENERATED_ASSET_BASE}/world-bed.svg`,
    SVG_SIZE,
  );
  scene.load.svg(
    VISUAL_TEXTURE_KEYS.worldShippingBin,
    `${GENERATED_ASSET_BASE}/world-shipping-bin.svg`,
    SVG_SIZE,
  );
}
