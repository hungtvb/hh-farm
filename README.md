# HH Farm

A cozy, browser-first 2D farming game built with Phaser 4, TypeScript and Vite.

## Current milestone

`TON-212 — Implement versioned IndexedDB save spike and recovery tests`

The repository currently contains the validated farm-map contract, player movement prototype, reproducible crop benchmark and versioned local-save foundation. Production gameplay, art and deployment are tracked separately in Linear.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Commands

```bash
npm ci
npm run generate:maps
npm run dev
npm run check
npm run test:e2e
npm run preview
```

`npm run generate:maps` rebuilds the deterministic contract fixture at `public/maps/farm-test.json`. `npm run check` verifies that the committed fixture matches the generator, then executes type checking, linting, unit tests and a production build. `npm run test:e2e` boots that production build in Chromium and verifies the farm runtime, scene restart lifecycle, crop benchmark and IndexedDB save recovery.

## Architecture

```text
src/
├── domain/          # Pure game rules, save contracts and benchmark statistics.
├── application/     # Use cases and ports, including save/recovery policy.
├── infrastructure/  # Browser adapters such as IndexedDB.
├── game/            # Phaser bootstrap, scenes, world loading and render/input adapters.
├── data/            # Typed content catalogs, Tiled contracts and validation.
└── ui/              # Browser UI overlays and presenters.
```

Domain code is intentionally isolated from Phaser and browser storage APIs so farming rules, content contracts, benchmark statistics and save migration can be tested without booting a renderer or IndexedDB.

## World authoring

The technical test world is generated deterministically as Tiled-compatible orthogonal JSON. The same required layer names, object properties and stable identity rules apply when production maps are authored and exported from Tiled; they are documented in [Farm map contract v1](docs/maps/farm-map-contract.md).

Tiled numeric object IDs are editor metadata and must not be used as persistent game identity. Object layers use globally unique semantic `stableId` properties instead.

## Crop benchmark

Build and serve the production bundle, then open the static benchmark:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

```text
http://localhost:4173/?benchmark=crops&strategy=static
```

The scene renders 300 crops, warms up for one second, samples for five seconds and displays mean FPS, p95 frame time and Long Task count directly on screen. Other comparison modes are `baseline`, `naive` and `batched`.

Automated evidence recommends individual crop Images with event-driven state changes and no per-frame crop update loop. Absolute 60 FPS Chrome desktop and stable 30 FPS Safari iPhone targets still require physical-device verification. See [TON-210 benchmark report](docs/benchmarks/TON-210-crop-render-memory.md).

## IndexedDB save spike

The production bundle includes a technical harness used by automated recovery tests:

```text
/?save-spike=reset
/?save-spike=save&farmName=Persistent%20Farm&day=9&coins=1775&x=416&y=288
/?save-spike=load
/?save-spike=seed-recovery
/?save-spike=seed-v1
/?save-spike=unavailable
```

The v2 envelope stores game/schema metadata and farm/player payload. IndexedDB keeps `current` and `previous` slots; invalid current data returns an explicit recovered/unrecoverable result rather than silently resetting the farm. See [TON-212 save and recovery contract](docs/save/TON-212-versioned-indexeddb.md).

## Verification

GitHub Actions regenerates the farm fixture and rejects drift, then runs `npm ci`, typecheck, lint, unit tests, a production build and serialized Chromium runtime tests for pull requests and pushes to `main`.

The browser suite includes a persistent-profile test that closes Chromium completely, reopens it with the same profile and verifies the exact IndexedDB save. It also checks corrupted-current recovery, v1 migration and unavailable storage.

The current scaffold intentionally ships Phaser in the initial game bundle. Bundle splitting and production asset-loading budgets are handled by `TON-224` after the core technical spike.

## Project links

- [Game documentation](https://app.notion.com/p/3afb6030d8e281f49adce6779de18f4c)
- [Linear project](https://linear.app/tony-football/project/hh-farm-e73470525741)
