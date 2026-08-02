import { describe, expect, it } from 'vitest';
import { summarizeFrameTimes } from '../../src/domain/benchmark/frameMetrics';

describe('summarizeFrameTimes', () => {
  it('returns zero metrics when no valid samples exist', () => {
    expect(summarizeFrameTimes([0, -1, Number.NaN])).toEqual({
      sampleCount: 0,
      durationMs: 0,
      meanFrameMs: 0,
      medianFrameMs: 0,
      p95FrameMs: 0,
      p99FrameMs: 0,
      meanFps: 0,
      framesOver16_7Ms: 0,
      framesOver33_3Ms: 0,
    });
  });

  it('calculates percentiles without mutating the input', () => {
    const samples = [40, 16, 17, 15, 20];
    const metrics = summarizeFrameTimes(samples);

    expect(samples).toEqual([40, 16, 17, 15, 20]);
    expect(metrics.sampleCount).toBe(5);
    expect(metrics.durationMs).toBe(108);
    expect(metrics.meanFrameMs).toBeCloseTo(21.6);
    expect(metrics.medianFrameMs).toBe(17);
    expect(metrics.p95FrameMs).toBe(40);
    expect(metrics.p99FrameMs).toBe(40);
    expect(metrics.meanFps).toBeCloseTo(46.296, 3);
    expect(metrics.framesOver16_7Ms).toBe(3);
    expect(metrics.framesOver33_3Ms).toBe(1);
  });

  it('reports a stable sixty-frame-per-second sample', () => {
    const metrics = summarizeFrameTimes(Array.from({ length: 120 }, () => 16));

    expect(metrics.meanFps).toBe(62.5);
    expect(metrics.p95FrameMs).toBe(16);
    expect(metrics.framesOver16_7Ms).toBe(0);
    expect(metrics.framesOver33_3Ms).toBe(0);
  });
});
