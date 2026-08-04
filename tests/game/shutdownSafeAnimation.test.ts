import { describe, expect, it, vi } from 'vitest';
import { stopAnimationOnShutdown } from '../../src/game/player/shutdownSafeAnimation';

describe('stopAnimationOnShutdown', () => {
  it('stops an animation state that is still attached', () => {
    const stop = vi.fn();

    stopAnimationOnShutdown({ anims: { stop } });

    expect(stop).toHaveBeenCalledOnce();
  });

  it('is safe after Phaser has released the animation state', () => {
    expect(() => stopAnimationOnShutdown({})).not.toThrow();
  });
});
