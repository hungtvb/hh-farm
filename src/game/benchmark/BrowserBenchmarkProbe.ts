import {
  type FrameMetrics,
  summarizeFrameTimes,
} from '../../domain/benchmark/frameMetrics';

const DEFAULT_WARMUP_MS = 1_000;
const DEFAULT_SAMPLE_DURATION_MS = 5_000;

export type BrowserBenchmarkResult = FrameMetrics &
  Readonly<{
    longTaskCount: number;
    longTaskDurationMs: number;
  }>;

export type BrowserBenchmarkCompleteHandler = (
  result: BrowserBenchmarkResult,
) => void;

export class BrowserBenchmarkProbe {
  private readonly canvas: HTMLCanvasElement;
  private readonly warmupMs: number;
  private readonly sampleDurationMs: number;
  private readonly onComplete: BrowserBenchmarkCompleteHandler | undefined;
  private readonly frameTimesMs: number[] = [];

  private frameRequestId: number | undefined;
  private previousFrameTimestamp: number | undefined;
  private sampleStartedAt: number | undefined;
  private longTaskCount = 0;
  private longTaskDurationMs = 0;
  private observer: PerformanceObserver | undefined;
  private stopped = false;

  public constructor(
    canvas: HTMLCanvasElement,
    onComplete?: BrowserBenchmarkCompleteHandler,
    warmupMs = DEFAULT_WARMUP_MS,
    sampleDurationMs = DEFAULT_SAMPLE_DURATION_MS,
  ) {
    this.canvas = canvas;
    this.onComplete = onComplete;
    this.warmupMs = warmupMs;
    this.sampleDurationMs = sampleDurationMs;
    this.canvas.dataset.benchmarkStatus = 'warming-up';

    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      this.observer = new PerformanceObserver((entryList) => {
        if (this.sampleStartedAt === undefined) {
          return;
        }

        for (const entry of entryList.getEntries()) {
          if (entry.startTime >= this.sampleStartedAt) {
            this.longTaskCount += 1;
            this.longTaskDurationMs += entry.duration;
          }
        }
      });
      this.observer.observe({ entryTypes: ['longtask'] });
    }

    this.frameRequestId = requestAnimationFrame(this.handleFrame);
  }

  public destroy(): void {
    if (this.stopped) {
      return;
    }

    this.stopped = true;

    if (this.frameRequestId !== undefined) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = undefined;
    }

    this.observer?.disconnect();
    this.observer = undefined;
  }

  private readonly handleFrame = (timestamp: number): void => {
    if (this.stopped) {
      return;
    }

    if (this.sampleStartedAt === undefined) {
      const firstTimestamp = this.previousFrameTimestamp;

      if (firstTimestamp === undefined) {
        this.previousFrameTimestamp = timestamp;
        this.frameRequestId = requestAnimationFrame(this.handleFrame);
        return;
      }

      if (timestamp - firstTimestamp < this.warmupMs) {
        this.frameRequestId = requestAnimationFrame(this.handleFrame);
        return;
      }

      this.sampleStartedAt = timestamp;
      this.previousFrameTimestamp = timestamp;
      this.canvas.dataset.benchmarkStatus = 'sampling';
      this.frameRequestId = requestAnimationFrame(this.handleFrame);
      return;
    }

    const previousTimestamp = this.previousFrameTimestamp;

    if (previousTimestamp !== undefined) {
      this.frameTimesMs.push(timestamp - previousTimestamp);
    }

    this.previousFrameTimestamp = timestamp;

    if (timestamp - this.sampleStartedAt >= this.sampleDurationMs) {
      this.complete();
      return;
    }

    this.frameRequestId = requestAnimationFrame(this.handleFrame);
  };

  private complete(): void {
    const frameMetrics = summarizeFrameTimes(this.frameTimesMs);
    const result: BrowserBenchmarkResult = {
      ...frameMetrics,
      longTaskCount: this.longTaskCount,
      longTaskDurationMs: this.longTaskDurationMs,
    };

    this.canvas.dataset.benchmarkStatus = 'complete';
    this.canvas.dataset.benchmarkSampleCount = String(result.sampleCount);
    this.canvas.dataset.benchmarkDurationMs = result.durationMs.toFixed(2);
    this.canvas.dataset.benchmarkMeanFps = result.meanFps.toFixed(2);
    this.canvas.dataset.benchmarkMeanFrameMs = result.meanFrameMs.toFixed(2);
    this.canvas.dataset.benchmarkMedianFrameMs =
      result.medianFrameMs.toFixed(2);
    this.canvas.dataset.benchmarkP95FrameMs = result.p95FrameMs.toFixed(2);
    this.canvas.dataset.benchmarkP99FrameMs = result.p99FrameMs.toFixed(2);
    this.canvas.dataset.benchmarkFramesOver16_7Ms = String(
      result.framesOver16_7Ms,
    );
    this.canvas.dataset.benchmarkFramesOver33_3Ms = String(
      result.framesOver33_3Ms,
    );
    this.canvas.dataset.benchmarkLongTaskCount = String(
      result.longTaskCount,
    );
    this.canvas.dataset.benchmarkLongTaskDurationMs =
      result.longTaskDurationMs.toFixed(2);

    this.onComplete?.(result);
    this.destroy();
  }
}
