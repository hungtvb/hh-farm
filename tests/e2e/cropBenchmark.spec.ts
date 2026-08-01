import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Locator, type Page, test } from '@playwright/test';

test.describe.configure({ retries: 0 });

type BenchmarkStrategy = 'baseline' | 'batched' | 'naive' | 'static';

type FrameBenchmarkResult = Readonly<{
  strategy: string;
  sampleCount: number;
  durationMs: number;
  meanFps: number;
  meanFrameMs: number;
  medianFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  framesOver16_7Ms: number;
  framesOver33_3Ms: number;
  longTaskCount: number;
  longTaskDurationMs: number;
}>;

type ChromeMemorySnapshot = Readonly<{
  jsHeapUsedBytes: number;
  jsHeapTotalBytes: number;
  documents: number;
  nodes: number;
  jsEventListeners: number;
}>;

async function readNumberAttribute(
  locator: Locator,
  attributeName: string,
): Promise<number> {
  const rawValue = await locator.getAttribute(attributeName);

  if (rawValue === null) {
    throw new Error(`Missing numeric attribute "${attributeName}".`);
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`Attribute "${attributeName}" is not finite: ${rawValue}`);
  }

  return value;
}

async function openCropBenchmark(
  page: Page,
  strategy: BenchmarkStrategy,
): Promise<Locator> {
  await page.goto(`/?benchmark=crops&strategy=${strategy}`);

  const canvas = page.locator(
    `canvas[data-scene="crop-benchmark"][data-benchmark-strategy="${strategy}"]`,
  );
  const expectedCropCount = strategy === 'baseline' ? '0' : '300';

  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await expect(canvas).toHaveAttribute(
    'data-crop-count',
    expectedCropCount,
  );
  await expect(canvas).toHaveAttribute(
    'data-benchmark-asset-set',
    'procedural-crop-v1',
  );
  await expect(canvas).toHaveAttribute('data-benchmark-status', 'complete', {
    timeout: 12_000,
  });

  return canvas;
}

async function readFrameBenchmark(
  canvas: Locator,
): Promise<FrameBenchmarkResult> {
  const strategy = await canvas.getAttribute('data-benchmark-strategy');

  if (strategy === null) {
    throw new Error('Missing benchmark strategy attribute.');
  }

  return {
    strategy,
    sampleCount: await readNumberAttribute(
      canvas,
      'data-benchmark-sample-count',
    ),
    durationMs: await readNumberAttribute(canvas, 'data-benchmark-duration-ms'),
    meanFps: await readNumberAttribute(canvas, 'data-benchmark-mean-fps'),
    meanFrameMs: await readNumberAttribute(
      canvas,
      'data-benchmark-mean-frame-ms',
    ),
    medianFrameMs: await readNumberAttribute(
      canvas,
      'data-benchmark-median-frame-ms',
    ),
    p95FrameMs: await readNumberAttribute(
      canvas,
      'data-benchmark-p95-frame-ms',
    ),
    p99FrameMs: await readNumberAttribute(
      canvas,
      'data-benchmark-p99-frame-ms',
    ),
    framesOver16_7Ms: await readNumberAttribute(
      canvas,
      'data-benchmark-frames-over16_7-ms',
    ),
    framesOver33_3Ms: await readNumberAttribute(
      canvas,
      'data-benchmark-frames-over33_3-ms',
    ),
    longTaskCount: await readNumberAttribute(
      canvas,
      'data-benchmark-long-task-count',
    ),
    longTaskDurationMs: await readNumberAttribute(
      canvas,
      'data-benchmark-long-task-duration-ms',
    ),
  };
}

async function readChromeMemory(page: Page): Promise<ChromeMemorySnapshot> {
  const session = await page.context().newCDPSession(page);

  try {
    await session.send('Performance.enable');
    await session.send('HeapProfiler.enable');
    await session.send('HeapProfiler.collectGarbage');

    const performanceResult = await session.send('Performance.getMetrics');
    const domCounters = await session.send('Memory.getDOMCounters');
    const metricMap = new Map(
      performanceResult.metrics.map((metric) => [metric.name, metric.value]),
    );
    const jsHeapUsedBytes = metricMap.get('JSHeapUsedSize');
    const jsHeapTotalBytes = metricMap.get('JSHeapTotalSize');

    if (jsHeapUsedBytes === undefined || jsHeapTotalBytes === undefined) {
      throw new Error('Chrome did not return JS heap metrics.');
    }

    return {
      jsHeapUsedBytes,
      jsHeapTotalBytes,
      documents: domCounters.documents,
      nodes: domCounters.nodes,
      jsEventListeners: domCounters.jsEventListeners,
    };
  } finally {
    await session.detach();
  }
}

async function restartBenchmark(
  page: Page,
  canvas: Locator,
): Promise<void> {
  const previousSceneInstance = await readNumberAttribute(
    canvas,
    'data-benchmark-scene-instance',
  );
  const previousShutdownCount = await readNumberAttribute(
    canvas,
    'data-benchmark-scene-shutdown-count',
  );
  const previousRequestCount = await readNumberAttribute(
    canvas,
    'data-benchmark-restart-request-count',
  );
  const previousDisplayObjectCount = await readNumberAttribute(
    canvas,
    'data-benchmark-display-object-count',
  );

  await page.keyboard.down('KeyR');
  await page.waitForTimeout(50);
  await page.keyboard.up('KeyR');

  await expect
    .poll(() =>
      readNumberAttribute(canvas, 'data-benchmark-scene-instance'),
    )
    .toBe(previousSceneInstance + 1);
  await expect
    .poll(() =>
      readNumberAttribute(canvas, 'data-benchmark-scene-shutdown-count'),
    )
    .toBe(previousShutdownCount + 1);
  await expect
    .poll(() =>
      readNumberAttribute(canvas, 'data-benchmark-restart-request-count'),
    )
    .toBe(previousRequestCount + 1);
  await expect(canvas).toHaveAttribute('data-crop-count', '300');
  await expect
    .poll(() =>
      readNumberAttribute(canvas, 'data-benchmark-display-object-count'),
    )
    .toBe(previousDisplayObjectCount);
}

function verifyCompleteSample(result: FrameBenchmarkResult): void {
  expect(result.durationMs).toBeGreaterThanOrEqual(4_900);
  expect(result.sampleCount).toBeGreaterThanOrEqual(60);
}

test('compares crop architectures on hosted Chromium', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000);

  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console.error: ${message.text()}`);
    }
  });

  const baselineCanvas = await openCropBenchmark(page, 'baseline');
  const baselineFrames = await readFrameBenchmark(baselineCanvas);
  const baselineMemory = await readChromeMemory(page);

  const batchedCanvas = await openCropBenchmark(page, 'batched');
  const batchedFrames = await readFrameBenchmark(batchedCanvas);
  const batchedMemory = await readChromeMemory(page);

  await page.screenshot({
    path: 'test-results/crop-benchmark-batched.png',
    fullPage: true,
  });

  const staticCanvas = await openCropBenchmark(page, 'static');
  const staticFrames = await readFrameBenchmark(staticCanvas);
  const staticMemory = await readChromeMemory(page);

  await page.screenshot({
    path: 'test-results/crop-benchmark-static.png',
    fullPage: true,
  });

  const naiveCanvas = await openCropBenchmark(page, 'naive');
  const naiveFrames = await readFrameBenchmark(naiveCanvas);
  const naiveMemory = await readChromeMemory(page);

  const restartCanvas = await openCropBenchmark(page, 'static');
  const restartBaseline = await readChromeMemory(page);

  for (let index = 0; index < 5; index += 1) {
    await restartBenchmark(page, restartCanvas);
  }
  const memoryAfterFiveRestarts = await readChromeMemory(page);

  for (let index = 0; index < 5; index += 1) {
    await restartBenchmark(page, restartCanvas);
  }
  const memoryAfterTenRestarts = await readChromeMemory(page);

  await expect(restartCanvas).toHaveAttribute(
    'data-benchmark-status',
    'complete',
    { timeout: 12_000 },
  );

  const secondBatchHeapGrowth =
    memoryAfterTenRestarts.jsHeapUsedBytes -
    memoryAfterFiveRestarts.jsHeapUsedBytes;
  const secondBatchNodeGrowth =
    memoryAfterTenRestarts.nodes - memoryAfterFiveRestarts.nodes;
  const secondBatchListenerGrowth =
    memoryAfterTenRestarts.jsEventListeners -
    memoryAfterFiveRestarts.jsEventListeners;
  const batchedFpsRetention = batchedFrames.meanFps / baselineFrames.meanFps;
  const staticFpsRetention = staticFrames.meanFps / baselineFrames.meanFps;
  const naiveFpsRetention = naiveFrames.meanFps / baselineFrames.meanFps;
  const batchedVsStatic = batchedFrames.meanFps / staticFrames.meanFps;
  const staticVsNaive = staticFrames.meanFps / naiveFrames.meanFps;
  const batchedVsNaive = batchedFrames.meanFps / naiveFrames.meanFps;

  const report = {
    benchmark: 'TON-210',
    testedCommitSha: process.env.GITHUB_SHA ?? 'local',
    headRef: process.env.GITHUB_HEAD_REF ?? 'local',
    environmentClassification: 'github-hosted-headless-chromium',
    acceptanceTargets: {
      chromeDesktopMeanFps: 60,
      safariIPhoneMinimumFps: 30,
      requiresPhysicalDeviceEvidence: true,
    },
    recommendation: {
      architecture: 'event-driven-static-images',
      rationale:
        'Static individual crop images consistently avoid naive per-frame update cost while preserving per-crop interaction and y-depth. RenderTexture batching is retained as an optional distant/chunk optimization because its advantage over static images was not consistent across hosted runners.',
    },
    automatedArchitectureGate: {
      staticVsNaiveMinimum: 1.2,
      staticP95MustNotExceedNaive: true,
    },
    project: testInfo.project.name,
    browserVersion: browser.version(),
    platform: process.platform,
    viewport: page.viewportSize(),
    assetSet: 'procedural-crop-v1',
    cropCount: 300,
    frameResults: {
      baseline: baselineFrames,
      batched: batchedFrames,
      static: staticFrames,
      naive: naiveFrames,
      batchedFpsRetention,
      staticFpsRetention,
      naiveFpsRetention,
      batchedVsStatic,
      staticVsNaive,
      batchedVsNaive,
    },
    strategyMemory: {
      baseline: baselineMemory,
      batched: batchedMemory,
      static: staticMemory,
      naive: naiveMemory,
    },
    restartMemory: {
      baseline: restartBaseline,
      afterFiveRestarts: memoryAfterFiveRestarts,
      afterTenRestarts: memoryAfterTenRestarts,
      secondBatchHeapGrowth,
      secondBatchNodeGrowth,
      secondBatchListenerGrowth,
    },
    runtimeErrors,
  };
  const reportJson = `${JSON.stringify(report, null, 2)}\n`;

  await mkdir('test-results', { recursive: true });
  await writeFile(
    'test-results/crop-benchmark-results.json',
    reportJson,
    'utf8',
  );
  await testInfo.attach('crop-benchmark-results', {
    body: Buffer.from(reportJson, 'utf8'),
    contentType: 'application/json',
  });

  verifyCompleteSample(baselineFrames);
  verifyCompleteSample(batchedFrames);
  verifyCompleteSample(staticFrames);
  verifyCompleteSample(naiveFrames);
  expect(staticVsNaive).toBeGreaterThanOrEqual(1.2);
  expect(staticFrames.p95FrameMs).toBeLessThanOrEqual(naiveFrames.p95FrameMs);
  expect(secondBatchHeapGrowth).toBeLessThan(2 * 1024 * 1024);
  expect(secondBatchNodeGrowth).toBeLessThanOrEqual(20);
  expect(secondBatchListenerGrowth).toBeLessThanOrEqual(2);
  expect(runtimeErrors).toEqual([]);
});
