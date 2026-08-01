export type FrameMetrics = Readonly<{
  sampleCount: number;
  durationMs: number;
  meanFrameMs: number;
  medianFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  meanFps: number;
  framesOver16_7Ms: number;
  framesOver33_3Ms: number;
}>;

const SIXTY_FPS_FRAME_MS = 1000 / 60;
const THIRTY_FPS_FRAME_MS = 1000 / 30;

function percentile(sortedValues: readonly number[], ratio: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * ratio) - 1),
  );

  return sortedValues[index] ?? 0;
}

export function summarizeFrameTimes(
  frameTimesMs: readonly number[],
): FrameMetrics {
  const validSamples = frameTimesMs
    .filter((frameTime) => Number.isFinite(frameTime) && frameTime > 0)
    .toSorted((left, right) => left - right);

  if (validSamples.length === 0) {
    return {
      sampleCount: 0,
      durationMs: 0,
      meanFrameMs: 0,
      medianFrameMs: 0,
      p95FrameMs: 0,
      p99FrameMs: 0,
      meanFps: 0,
      framesOver16_7Ms: 0,
      framesOver33_3Ms: 0,
    };
  }

  const durationMs = validSamples.reduce(
    (total, frameTime) => total + frameTime,
    0,
  );
  const meanFrameMs = durationMs / validSamples.length;

  return {
    sampleCount: validSamples.length,
    durationMs,
    meanFrameMs,
    medianFrameMs: percentile(validSamples, 0.5),
    p95FrameMs: percentile(validSamples, 0.95),
    p99FrameMs: percentile(validSamples, 0.99),
    meanFps: 1000 / meanFrameMs,
    framesOver16_7Ms: validSamples.filter(
      (frameTime) => frameTime > SIXTY_FPS_FRAME_MS,
    ).length,
    framesOver33_3Ms: validSamples.filter(
      (frameTime) => frameTime > THIRTY_FPS_FRAME_MS,
    ).length,
  };
}
