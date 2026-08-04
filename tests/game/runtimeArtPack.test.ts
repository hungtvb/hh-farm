import { describe, expect, it } from 'vitest';
import {
  getCropFrameKey,
  getCropTextureKey,
  getEnvironmentFrameKey,
  getPlayerAnimationKey,
  parseRuntimeFrameSheetMetadata,
  playerAnimationForFarmAction,
  RUNTIME_ART_TEXTURE_KEYS,
} from '../../src/game/assets/runtimeArtPackContract.js';

describe('runtime art pack', () => {
  it('parses deterministic frame metadata and rejects duplicates', () => {
    const metadata = parseRuntimeFrameSheetMetadata(
      {
        textureId: 'environment.grass',
        sourceFile: 'environment-grass.svg',
        frameWidth: 64,
        frameHeight: 64,
        usedFrames: 2,
        frames: [
          {
            stableFrameKey: 'environment.grass.00',
            x: 0,
            y: 0,
            width: 64,
            height: 64,
          },
          {
            stableFrameKey: 'environment.grass.01',
            x: 64,
            y: 0,
            width: 64,
            height: 64,
          },
        ],
      },
      'environment.grass',
    );

    expect(metadata.usedFrames).toBe(2);
    expect(metadata.frames.at(-1)?.stableFrameKey).toBe(
      'environment.grass.01',
    );

    expect(() =>
      parseRuntimeFrameSheetMetadata(
        {
          ...metadata,
          frames: [metadata.frames[0], metadata.frames[0]],
        },
        'environment.grass',
      ),
    ).toThrow(/duplicate frame/);
  });

  it('resolves stable runtime keys without duplicating sheet coordinates', () => {
    expect(getPlayerAnimationKey('player.walk', 'right')).toBe(
      'runtime:player.walk:right',
    );
    expect(getCropTextureKey('turnip')).toBe(
      RUNTIME_ART_TEXTURE_KEYS.cropTurnip,
    );
    expect(getCropFrameKey('strawberry', 3)).toBe(
      'crop.strawberry.stage.03',
    );
    expect(getEnvironmentFrameKey('wood', 2)).toBe('environment.wood.02');
  });

  it('maps farm actions onto the declared player action families', () => {
    expect(playerAnimationForFarmAction('till')).toBe('player.hoe');
    expect(playerAnimationForFarmAction('plant')).toBe('player.hoe');
    expect(playerAnimationForFarmAction('water')).toBe('player.water');
    expect(playerAnimationForFarmAction('harvest')).toBe('player.harvest');
    expect(playerAnimationForFarmAction('sell')).toBe('player.harvest');
    expect(playerAnimationForFarmAction('next_day')).toBe('player.harvest');
  });
});
