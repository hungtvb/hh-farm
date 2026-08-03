# HH Farm

A cozy, browser-first 2D farming game built with Phaser 4, TypeScript and Vite.

## Current milestone

`TON-230 — Build visual foundation and asset pipeline v1`

The repository currently contains the validated farm-map contract, player movement prototype, reproducible crop benchmark, versioned local-save foundation, Pages delivery pipeline, typed gameplay content, atomic farming commands and the first reproducible visual/UI foundation.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Commands

```bash
npm ci
npm run generate:maps
npm run generate:assets
npm run validate:assets
npm run validate:content
npm run dev
npm run check
npm run test:e2e
npm run preview
```

`npm run generate:maps` rebuilds the deterministic contract fixture at `public/maps/farm-test.json`. `npm run generate:assets` rebuilds the generated SVG visual pack and manifest. `npm run validate:assets` checks asset identity, naming, anchors, SVG structure and byte budget. `npm run validate:content` compiles and validates the real crop/item/tool/shop source.

`npm run check` runs generated-map and generated-asset drift checks, asset/content validation, type checking, linting, unit tests, production build, build metadata and production diagnostics exclusion. `npm run test:e2e` rebuilds in the dedicated `e2e` mode, then verifies the farm runtime, scene restart lifecycle, crop benchmark, IndexedDB recovery, build identity and responsive visual shell in Chromium.

## Architecture

```text
assets/
└── source/          # Canonical visual-system inputs.

public/assets/
└── generated/       # Deterministic SVG output and manifest.

src/
├── build/           # Immutable build/deployment identity.
├── domain/          # Pure game and farming state transitions.
├── application/     # Use cases, ports and renderer/content adapters.
├── infrastructure/  # Browser adapters such as IndexedDB.
├── game/            # Phaser bootstrap, scenes, world loading and input adapters.
├── data/            # Typed content catalogs, Tiled contracts and validation.
└── ui/              # Browser HUD, responsive layout and presenters.
```

Domain and content validation remain isolated from Phaser and browser storage APIs, allowing farming rules, references, command failures, benchmark statistics and save migration to be tested without booting a renderer or IndexedDB.

## Visual foundation

The first in-game visual shell includes:

- day and weather information;
- coin and energy chips;
- an objective card;
- a responsive eight-slot hotbar;
- click and keyboard slot selection;
- hoe and watering-can icons;
- untilled, tilled and watered soil states;
- a selection cursor;
- four-stage turnip, carrot and strawberry sheets.

Visual tokens live in `assets/source/visual-system.json`. Generated files are reviewable SVG text and are never edited by hand. CI regenerates them and rejects output drift or a manifest that exceeds its budget.

The DOM HUD owns presentation only. Phaser preloads the generated farm assets, while authoritative farming state remains in the domain layer. Desktop and portrait mobile screenshot gates verify safe-area composition, loaded assets and interactive selection. See [TON-230 visual foundation contract](docs/art/TON-230-visual-foundation.md).

## Farming commands

`FarmTileState` is the authoritative source for soil, water and crop state. The pure command layer provides:

- `tillSoil`;
- `plantSeed`;
- `waterTile`;
- `harvestCrop`.

Commands return immutable success/failure results and typed domain events. Failed commands retain the exact original aggregate state and emit no events. Planting consumes one seed only after all preconditions pass. Harvesting clears a mature crop only after inventory accepts the full predetermined yield; a full inventory leaves the crop untouched.

Content and inventory are supplied through pure ports. Phaser receives projected tile state and events through an application renderer adapter; it does not own farming rules. See [TON-215 farming command contract](docs/farming/TON-215-farming-commands.md).

## Typed gameplay content

The source catalog defines:

- turnip, carrot and strawberry crops;
- seed and harvested-produce items;
- hoe and watering-can tools;
- seed shop offers;
- registered sprite keys and crop growth stages.

Catalog validation rejects duplicate IDs, negative prices, invalid quantities and boundaries, missing sprite keys, malformed growth stages, invalid yields and broken item/category references. Every issue includes a path, stable error code and message.

Gameplay code consumes the validated immutable `gameContentCatalog`; it must not duplicate prices, growth durations, yields or sprite keys. See [data-layer documentation](src/data/README.md).

## World authoring

The technical test world is generated deterministically as Tiled-compatible orthogonal JSON. Production maps use the same required layer names, object properties and stable identity rules documented in [Farm map contract v1](docs/maps/farm-map-contract.md).

Tiled numeric object IDs are editor metadata and must not be used as persistent game identity. Object layers use globally unique semantic `stableId` properties instead.

## Crop benchmark

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

```text
http://localhost:4173/?benchmark=crops&strategy=static
```

The scene renders 300 crops, warms up for one second, samples for five seconds and displays mean FPS, p95 frame time and Long Task count. Automated evidence recommends individual crop Images with event-driven state changes and no per-frame crop update loop. Physical-device targets remain documented in [TON-210 benchmark report](docs/benchmarks/TON-210-crop-render-memory.md).

## IndexedDB save spike

The v2 envelope stores game/schema metadata and farm/player payload. IndexedDB keeps `current` and `previous` slots; invalid current data returns an explicit recovered/unrecoverable result rather than silently resetting the farm.

Recovery diagnostics are available only in E2E builds and are excluded from production assets. See [TON-212 save and recovery contract](docs/save/TON-212-versioned-indexeddb.md).

## Build identity

Every build emits:

```text
/version.json
```

The same app version, commit SHA, ref, build time and deployment environment are attached to the root HTML element. Runtime and deployment tests reject mismatched identity.

## Cloudflare Pages delivery

`Verify` runs on pull requests and `main`. After it succeeds, `Deploy Pages`:

- deploys same-repository pull requests as preview branches;
- deploys successful `main` builds as production;
- rebuilds with exact release metadata;
- verifies the deployed commit, environment, farm map and referenced assets;
- comments the verified preview URL on the pull request.

Cloudflare publishing remains safely skipped until repository secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are configured. Build output is `dist`; project name is `hh-farm`.

Setup, required GitHub rules and rollback instructions are in [TON-213 Cloudflare Pages runbook](docs/deployment/TON-213-cloudflare-pages.md).

## Verification

GitHub Actions runs generated map/asset drift, asset/content validation, typecheck, lint, 58 unit tests, production build validation and eight serialized Chromium runtime tests. Browser evidence covers movement and restart lifecycle, crop rendering benchmark, IndexedDB recovery, build identity, desktop HUD and portrait mobile composition. Production assets are scanned to ensure technical save diagnostics are absent.

The current scaffold intentionally ships Phaser in the initial game bundle. Bundle splitting and production asset-loading budgets are handled by `TON-224`.

## Project links

- [Game documentation](https://app.notion.com/p/3afb6030d8e281388eebfa697607e784)
- [Linear project](https://linear.app/tony-football/project/hh-farm-e73470525741)
