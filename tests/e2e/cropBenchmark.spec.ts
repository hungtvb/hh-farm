import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type Locator, type Page, test } from '@playwright/test';

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
  strategy: 'naive' | 'static',
): Promise<Locator> {
  await page.goto(`/?benchmark=crops&strategy=${strategy}`);

  const canvas = page.locator(
    `canvas[data-scene="crop-benchmark"][data-benchmark-strategy="${strategy}"]`,
  );
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  await expect(canvas).toHaveAttribute('data-crop-count', '300');
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

test('profiles 300 crop objects and restart memory on desktop Chrome', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);

  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console.error: ${message.text()}`);
    }
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

  const report = {
    benchmark: 'TON-210',
    testedCommitSha: process.env.GITHUB_SHA ?? 'local',
    headRef: process.env.GITHUB_HEAD_REF ?? 'local',
    project: testInfo.project.name,
    browserVersion: browser.version(),
    platform: process.platform,
    viewport: page.viewportSize(),
    assetSet: 'procedural-crop-v1',
    cropCount: 300,
    frameResults: {
      static: staticFrames,
      naive: naiveFrames,
    },
    strategyMemory: {
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

  expect(staticFrames.durationMs).toBeGreaterThanOrEqual(4_900);
  expect(staticFrames.sampleCount).toBeGreaterThanOrEqual(60);
  expect(staticFrames.meanFps).toBeGreaterThanOrEqual(55);
  expect(staticFrames.p95FrameMs).toBeLessThanOrEqual(25);
  expect(staticFrames.framesOver33_3Ms).toBeLessThanOrEqual(2);
  expect(naiveFrames.durationMs).toBeGreaterThanOrEqual(4_900);
  expect(naiveFrames.sampleCount).toBeGreaterThanOrEqual(60);
  expect(naiveFrames.meanFps).toBeGreaterThanOrEqual(50);
  expect(secondBatchHeapGrowth).toBeLessThan(2 * 1024 * 1024);
  expect(secondBatchNodeGrowth).toBeLessThanOrEqual(20);
  expect(secondBatchListenerGrowth).toBeLessThanOrEqual(2);
  expect(runtimeErrors).toEqual([]);
});
