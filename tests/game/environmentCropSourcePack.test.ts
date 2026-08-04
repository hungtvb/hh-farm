import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type FrameRecord = {
  stableFrameKey: string;
  stage?: number;
  variant?: string;
  occupancy: number;
  bounds: { width: number; height: number };
}

type SheetMetadata = {
  textureId: string;
  kind: string;
  frames: FrameRecord[];
}

function readMetadata(file: string): SheetMetadata {
  return JSON.parse(
    readFileSync(path.resolve('public/assets/generated', file), 'utf8'),
  ) as SheetMetadata;
}

describe('environment and crop source pack', () => {
  it('provides four stable variants for every environment sheet', () => {
    for (const kind of ['grass', 'water', 'wood']) {
      const metadata = readMetadata(`environment-${kind}.frames.json`);
      expect(metadata.textureId).toBe(`environment.${kind}`);
      expect(metadata.kind).toBe('environment-variant-sheet');
      expect(metadata.frames).toHaveLength(4);
      expect(metadata.frames.map((frame) => frame.stableFrameKey)).toEqual(
        Array.from(
          { length: 4 },
          (_, index) => `environment.${kind}.${String(index).padStart(2, '0')}`,
        ),
      );
      expect(metadata.frames.every((frame) => Boolean(frame.variant))).toBe(
        true,
      );
    }
  });

  it('keeps crop silhouettes growing across adjacent stages', () => {
    for (const kind of ['turnip', 'carrot', 'strawberry']) {
      const metadata = readMetadata(`crop-${kind}.frames.json`);
      expect(metadata.textureId).toBe(`crop.${kind}.stages`);
      expect(metadata.kind).toBe('crop-stage-sheet');
      expect(metadata.frames).toHaveLength(4);

      for (let stage = 1; stage < metadata.frames.length; stage += 1) {
        const previous = metadata.frames[stage - 1];
        const current = metadata.frames[stage];
        expect(current.stage).toBe(stage);
        expect(current.occupancy).toBeGreaterThan(previous.occupancy);
        expect(
          current.bounds.width > previous.bounds.width ||
            current.bounds.height > previous.bounds.height,
        ).toBe(true);
      }
    }
  });
});
