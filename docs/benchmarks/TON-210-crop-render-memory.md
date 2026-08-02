# TON-210 — 300 crop render and memory benchmark

## Verdict

Use **300 individual crop images with event-driven updates** for the first production implementation.

Each crop may keep its own render object for interaction, selection and Y-depth, but crop textures and depth must change only when gameplay state changes. Do not iterate over every crop each frame.

Keep RenderTexture batching as an optional later optimization for distant, non-interactive or chunked content. Hosted Chromium results did not show a consistent advantage over static individual images.

This document records the automated architecture and memory evidence. The absolute acceptance targets still require physical-device evidence:

- Chrome desktop: target 60 FPS.
- Safari on a real iPhone: stable minimum 30 FPS.

Neither target is marked complete by GitHub-hosted headless Chromium.

## Reproduce the benchmark

```bash
npm ci
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Open one of these URLs:

```text
/?benchmark=crops&strategy=baseline
/?benchmark=crops&strategy=static
/?benchmark=crops&strategy=naive
/?benchmark=crops&strategy=batched
```

The scene warms up for one second, samples requestAnimationFrame timing for five seconds and then shows:

```text
<mean FPS> · p95 <frame time> · <long task count>
```

Press `R` to restart the benchmark scene.

## Fixed fixture

| Field | Value |
| --- | --- |
| Crop count | 300 |
| Growth stages | 5 |
| Asset set | `procedural-crop-v1` |
| Layout | 25 columns × 12 rows |
| World/map | `farm-test` |
| Renderer comparison | baseline, batched, static, naive |
| Frame warm-up | 1,000 ms |
| Frame sample | 5,000 ms |
| Memory cycle | forced GC before each snapshot |
| Restart memory check | 10 restarts, split into two batches of five |

### Strategies

- `baseline`: map and benchmark HUD with zero crops.
- `static`: 300 individual Phaser Images; no crop work in the Scene update loop.
- `naive`: the same 300 Images, with position and depth recalculated every frame.
- `batched`: the same visible fixture stamped once into one tight RenderTexture.

## Exact automated evidence

| Field | Value |
| --- | --- |
| Branch head | `b00b90ccdfe9e2206736894f041b0e550084d6d6` |
| GitHub Actions run | `30693233147` |
| Checked PR merge ref | `2e5b896b2df9b03474b3c594ea02fa34ac7039cb` |
| Browser | Chromium `149.0.7827.55` |
| Environment | GitHub-hosted Ubuntu, headless Chromium |
| Browser viewport | 1280 × 720 |
| Runtime errors | none |
| Unit tests | 20/20 passed |

### Frame results

| Strategy | Mean FPS | Mean frame | Median | p95 | p99 | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 37.68 | 26.54 ms | 33.3 ms | 33.4 ms | 33.4 ms | 0 |
| Batched | 21.98 | 45.49 ms | 50.0 ms | 50.1 ms | 66.7 ms | 6 |
| Static | 23.76 | 42.08 ms | 33.4 ms | 50.1 ms | 66.7 ms | 6 |
| Naive | 17.48 | 57.19 ms | 50.1 ms | 66.7 ms | 83.4 ms | 88 |

Derived comparisons on the same runner:

- Static versus naive: `1.359×` mean FPS.
- Batched versus naive: `1.257×` mean FPS.
- Batched versus static: `0.925×` mean FPS.
- Static p95: `50.1 ms`; naive p95: `66.7 ms`.

The automated gate requires static to beat naive by at least 20%, have no worse p95 and pass the restart-memory checks. The final run passed.

## Repeatability and counter-evidence

Across valid hosted runs, static was consistently about `1.31×–1.39×` faster than naive update-all rendering.

RenderTexture batching was inconsistent relative to static individual images:

- One valid run: batched was about 21% faster than static.
- Later valid runs: batched was about 9% slower than static.

A previous batched result was discarded because the screenshot showed no crops: Phaser 4 buffered the stamp commands but the RenderTexture had not been flushed with `render()`. The fixture now calls `render()` and both static and batched screenshots visibly contain the same 300 crops.

This counter-evidence is why batching is not the default architecture. It adds complexity, weakens per-crop interaction/Y-depth semantics and did not produce a stable advantage on the available automated environment.

## Memory and restart evidence

Final forced-GC snapshots for the recommended static strategy:

| Snapshot | JS heap used | DOM nodes | JS listeners |
| --- | ---: | ---: | ---: |
| Before restarts | 6,738,880 bytes | 119 | 58 |
| After 5 restarts | 7,060,636 bytes | 119 | 53 |
| After 10 restarts | 7,270,304 bytes | 119 | 53 |

Second batch growth, restarts 6–10:

- Heap: `209,668 bytes` (~205 KiB).
- DOM nodes: `0`.
- JS event listeners: `0`.
- Runtime errors: none.

Other valid runs showed approximately 209–275 KiB second-batch heap growth with flat DOM node and listener counts. There is no observed continuous resource accumulation in the automated restart path.

## Architecture rule for implementation

Production crop rendering should follow these boundaries:

1. Keep crop growth and timing in domain/data state, not in Phaser frame logic.
2. Create one crop image per interactive crop while it is active or visible.
3. Change its texture only when the growth stage changes.
4. Change depth only when its tile/world position changes.
5. Do not animate all crops through a shared per-frame loop.
6. Use a shared texture atlas rather than one texture allocation per crop.
7. Consider chunk-level RenderTextures only for non-interactive or distant crops after physical-device profiling proves a need.
8. Re-run this benchmark with the production atlas before shipping M1.

## Physical Chrome desktop gate — pending

Record all of the following:

- Commit SHA and benchmark URL.
- CPU, GPU and RAM.
- Operating system and Chrome version.
- Display refresh rate, viewport and device-pixel ratio.
- Power mode and whether the machine is plugged in.
- Asset set and crop count shown in the HUD.
- Mean FPS, p95 and long-task count after the HUD completes.
- Result after 10 scene restarts.

Procedure:

1. Use `strategy=static`.
2. Close other GPU-heavy tabs and applications.
3. Reload once and allow the device to settle.
4. Record three completed five-second samples.
5. Use the median of the three mean-FPS values.
6. Pass target: 60 FPS on the selected supported desktop profile.
7. Capture a screenshot and attach it to TON-210.

## Physical Safari iPhone gate — pending

Record:

- iPhone model.
- iOS and Safari version.
- Battery level, Low Power Mode and thermal state if known.
- Viewport orientation and device-pixel ratio.
- Commit SHA, asset set and crop count.
- Three HUD samples using `strategy=static`.
- Result after 10 scene restarts.

Procedure:

1. Serve the production build over HTTPS or a trusted local network endpoint.
2. Open the static benchmark URL in Safari, not an embedded web view.
3. Keep the phone in one orientation for all samples.
4. Allow the first run to warm caches, then record three completed samples.
5. Pass target: stable minimum 30 FPS without a rising restart-memory/resource trend.
6. Use Safari Web Inspector for memory evidence when available. Do not claim Chrome CDP heap numbers are equivalent to Safari memory.
7. Capture the final HUD screenshot and attach it to TON-210.

## Remaining risk

The automated environment is headless and strongly frame-rate constrained; absolute FPS varied with runner load. It is suitable for comparing implementations in the same run and detecting restart leaks, but not for certifying desktop or iPhone frame-rate targets.

The decision is therefore:

- **Observed:** static event-driven images consistently outperform naive per-frame crop updates and do not accumulate DOM/listener resources across restarts.
- **Derived:** static images are the lowest-complexity production default that preserves gameplay semantics.
- **Unverified:** absolute 60 FPS Chrome desktop and stable 30 FPS Safari iPhone targets.
