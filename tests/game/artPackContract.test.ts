import { describe, expect, it } from 'vitest';
import {
  ART_PACK_DIRECTIONS,
  getPlayerAnimationDurationMs,
  getPlayerFrameAddress,
  getPlayerImpactTimeMs,
  listPlayerFrameAddresses,
  PLAYER_ANIMATIONS,
  PLAYER_BODY,
  PLAYER_FOOT_Y,
  PLAYER_FRAME_HEIGHT,
  PLAYER_FRAME_WIDTH,
  PLAYER_ORIGIN,
} from '../../src/game/assets/artPackContract.js';

describe('vertical slice art pack contract', () => {
  it('keeps one foot anchor and collision footprint for every player frame', () => {
    expect(PLAYER_FRAME_WIDTH).toBe(64);
    expect(PLAYER_FRAME_HEIGHT).toBe(80);
    expect(PLAYER_ORIGIN).toEqual({ x: 0.5, y: 1 });
    expect(PLAYER_FOOT_Y).toBe(72);
    expect(PLAYER_BODY).toEqual({
      width: 24,
      height: 14,
      offsetX: 20,
      offsetY: 62,
    });
    expect(PLAYER_BODY.offsetY + PLAYER_BODY.height).toBe(76);
  });

  it('addresses every direction and frame with a stable zero-padded key', () => {
    const walkFrames = listPlayerFrameAddresses('player.walk');

    expect(ART_PACK_DIRECTIONS).toEqual(['down', 'left', 'right', 'up']);
    expect(walkFrames).toHaveLength(24);
    expect(walkFrames[0]).toEqual({
      animationId: 'player.walk',
      direction: 'down',
      frameIndex: 0,
      stableFrameKey: 'player.walk.down.01',
    });
    expect(walkFrames.at(-1)).toEqual({
      animationId: 'player.walk',
      direction: 'up',
      frameIndex: 5,
      stableFrameKey: 'player.walk.up.06',
    });
  });

  it('places tool impact after anticipation and before recovery', () => {
    expect(getPlayerImpactTimeMs('player.hoe')).toBe(180);
    expect(getPlayerImpactTimeMs('player.water')).toBe(270);
    expect(getPlayerImpactTimeMs('player.harvest')).toBe(170);

    for (const animationId of [
      'player.hoe',
      'player.water',
      'player.harvest',
    ] as const) {
      const impact = getPlayerImpactTimeMs(animationId);
      const duration = getPlayerAnimationDurationMs(animationId);
      expect(impact).not.toBeNull();
      expect(impact).toBeGreaterThanOrEqual(160);
      expect(impact).toBeLessThan(duration);
      expect(duration - (impact ?? 0)).toBeGreaterThanOrEqual(170);
      expect(PLAYER_ANIMATIONS[animationId].loop).toBe(false);
    }
  });

  it('rejects frame addresses outside the animation contract', () => {
    expect(() => getPlayerFrameAddress('player.idle', 'down', -1)).toThrow(
      /invalid/,
    );
    expect(() => getPlayerFrameAddress('player.idle', 'down', 4)).toThrow(
      /invalid/,
    );
  });
});
