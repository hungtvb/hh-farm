# HH Farm

A cozy, browser-first 2D farming game built with Phaser 4, TypeScript and Vite.

## Current milestone

`TON-219 — Deliver tutorial, action feedback and end-to-end farm loop`

The repository contains a playable autosaved vertical slice: a new player can till, plant, water through real crop-growth days, harvest, sell and reload progress without relying on external instructions.

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

`npm run generate:maps` rebuilds the deterministic map fixture. `npm run generate:assets` rebuilds the generated SVG visual pack and manifest. `npm run validate:assets` checks identity, naming, anchors, SVG structure and byte budget. `npm run validate:content` validates the crop/item/tool/shop catalog.

`npm run check` runs generated-output drift checks, asset/content validation, strict type checking and linting, unit tests, the production build, build metadata and production diagnostic exclusion.

`npm run test:e2e` runs two browser phases. Existing technical harnesses and regressions execute on the dedicated E2E bundle; the end-to-end farm loop then rebuilds and executes on the production bundle.

## Architecture

```text
assets/
└── source/          # Canonical visual-system inputs.

public/assets/
└── generated/       # Deterministic SVG output and manifest.

src/
├── build/           # Immutable build/deployment identity.
├── domain/          # Pure farming, inventory, economy, day, tutorial and save rules.
├── application/     # Coordinators, presenters, use cases and abstract ports.
├── infrastructure/  # Browser adapters such as IndexedDB.
├── game/            # Phaser bootstrap, scenes, world and input adapters.
├── data/            # Typed content catalogs and map validation.
└── ui/              # HUD, farm loop, inventory/shop dialogs and responsive layout.
```

Domain and content validation remain isolated from Phaser and browser storage APIs. Application coordinators depend on abstract ports; UI and IndexedDB provide concrete adapters at the edge.

## Production farm loop

`FarmLoopState` is the authoritative production aggregate for day, coins, field/crops, inventory, toolbar and tutorial progress. `FarmLoopCoordinator` is the only production write owner.

Every farm, toolbar and shop write follows the same order:

```text
resolve complete candidate
→ autosave candidate
→ commit in memory
→ refresh presentation
```

A save failure preserves the previous aggregate. Concurrent writes are rejected while a commit is in progress.

The event-driven tutorial guides the player through:

```text
xới đất
→ gieo củ cải
→ tưới
→ ngủ qua ngày
→ lặp tưới/ngủ đến khi chín
→ thu hoạch
→ bán
```

The tutorial uses real catalog growth stages and domain events. Invalid actions show a reason instead of silently disabling progress. Skipping changes tutorial metadata only and preserves the starter farm state.

Production progress is stored in a dedicated `hh-farm-loop-save` IndexedDB database with `current` and `previous` slots. Reload restores field state, crop progress, wallet, inventory, toolbar and tutorial state. See [TON-219 farm-loop contract](docs/farm-loop/TON-219-end-to-end-farm-loop.md).

## Wallet and shop economy

`EconomyState` commits one immutable wallet together with the authoritative `PlayerItemsState`. Wallet coins are non-negative safe integers, and every buy/sell operation either commits the complete wallet/inventory candidate or preserves the original aggregate.

The shop uses the validated content catalog for item identity, stack limits, buy prices, sell prices, offer quantities and unlock days. UI code does not duplicate economic values.

Buy transactions validate the complete cost, unlock day and inventory capacity before debit. Sell transactions validate ownership, sellability and coin-overflow safety before removing items. Selling the final item reuses toolbar cleanup from TON-217.

The shop presenter calls the same transaction engine to derive disabled states such as `insufficient_funds`, `inventory_full` and `offer_locked`. Desktop uses a centered market panel; portrait mobile uses a safe-area-aware scrollable sheet. Live feedback updates coins, inventory and toolbar quantities together.

A shop sale emits the same `item-sold` event observed by the tutorial, so selling harvested produce through either surface completes the farm loop. See [TON-218 wallet and shop economy contract](docs/economy/TON-218-shop-economy.md).

## Inventory and toolbar

`PlayerItemsState` coordinates one authoritative 12-slot inventory with an eight-slot toolbar. Toolbar entries bind by item ID rather than inventory slot, so quantities are derived from inventory and remain correct when stacks change.

Item transactions are atomic:

- additions fill matching stacks before empty slots;
- capacity is validated before any slot changes;
- removals require the complete requested quantity;
- failed transactions preserve the original aggregate;
- consuming the final item clears every toolbar binding for that item;
- farming and shop operations share the same inventory-full behavior.

The starting inventory and stack limits come from the validated content catalog. The DOM HUD receives immutable view models, emits select/bind intents and never edits quantities directly. Vietnamese labels are applied at the presentation boundary without changing catalog identity.

Controls:

- `1–8`: select a toolbar slot;
- `I`: open or close the inventory;
- `Escape`: close the active dialog;
- pointer/touch: run farm-loop actions, select a slot, bind an item and buy/sell shop items.

Desktop uses centered dialogs. Portrait mobile uses safe-area-aware sheets. See [TON-217 inventory and toolbar contract](docs/inventory/TON-217-inventory-toolbar.md).

## Day transition and crop growth

`resolveNextDay` validates every crop before creating an immutable candidate. A successful transition:

- increments the farm day exactly once;
- dries every watered tile;
- advances watered crops by at most one stage;
- tracks progress through multi-day stages;
- pauses unwatered crops without killing or resetting them;
- preserves mature crops for harvesting;
- emits typed crop events followed by one day event.

The production farm-loop coordinator applies the critical-save ordering before committing a day transition. The standalone `RequestNextDayCoordinator` remains available as the focused day-transition contract and test harness.

The v2 technical save envelope remains backward compatible: older v2 payloads may omit `field`; new saves persist and validate the complete farm field, soil, water, crop stage, progress and predetermined yield.

See [TON-216 day-transition contract](docs/farming/TON-216-day-transition.md).

## Visual foundation

The in-game visual shell includes day/weather, coin and energy chips, tutorial objective, responsive eight-slot hotbar, tool icons, three soil states, selection highlighting and four-stage turnip/carrot/strawberry sheets.

Visual tokens live in `assets/source/visual-system.json`. Generated SVGs are reviewable text and are never edited by hand. CI regenerates them and rejects output drift, stale files or budget violations.

The DOM HUD owns presentation only. Phaser preloads generated farm assets while authoritative gameplay state remains in the domain/application layers. See [TON-230 visual foundation contract](docs/art/TON-230-visual-foundation.md).

## Farming commands

`FarmTileState` is authoritative for soil, water and crop state. The pure command layer provides:

- `tillSoil`;
- `plantSeed`;
- `waterTile`;
- `harvestCrop`.

Failed commands retain the exact original aggregate and emit no events. Planting consumes a seed only after all preconditions pass. Harvest clears a mature crop only after inventory accepts the complete predetermined yield.

Content and inventory are supplied through pure ports. Phaser receives projected tile state and events and does not own farming rules. See [TON-215 farming command contract](docs/farming/TON-215-farming-commands.md).

## Typed gameplay content

The validated source catalog defines turnip, carrot and strawberry crops, seed/produce items, hoe/watering-can tools, seed shop offers, sprite keys and ordered growth stages.

Validation rejects duplicate IDs, negative prices, missing sprites, malformed growth stages, invalid yields and broken references. Gameplay consumes the immutable `gameContentCatalog`; feature code must not duplicate prices, growth durations, yields or sprite keys. See [data-layer documentation](src/data/README.md).

## World authoring

The technical world is generated deterministically as Tiled-compatible orthogonal JSON. Production maps use the same required layers, properties and stable identity rules documented in [Farm map contract v1](docs/maps/farm-map-contract.md).

Tiled numeric object IDs are editor metadata and must not be used as persistent game identity. Object layers use globally unique semantic `stableId` values.

## Crop benchmark

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Open:

```text
http://localhost:4173/?benchmark=crops&strategy=static
```

The benchmark renders 300 crops and reports mean FPS, p95 frame time and Long Task count. Automated evidence recommends individual crop Images with event-driven state changes and no per-frame crop update loop. Physical-device targets remain in [TON-210 benchmark report](docs/benchmarks/TON-210-crop-render-memory.md).

## IndexedDB save and recovery

Both the technical save foundation and production farm loop keep `current` and `previous` slots. Invalid current data produces explicit recovered/unrecoverable results rather than silently resetting progress. The production farm loop uses its own database so technical save-spike envelopes cannot be misread as player progress.

See [TON-212 save and recovery contract](docs/save/TON-212-versioned-indexeddb.md) and [TON-219 farm-loop contract](docs/farm-loop/TON-219-end-to-end-farm-loop.md).

## Build identity and delivery

Every build emits `/version.json`; the same identity is attached to the running app. Deployment tests reject mismatched commits or environments.

After `Verify` succeeds, `Deploy Pages` can publish same-repository pull requests as previews and `main` as production, then smoke-test the deployed identity, map and referenced assets. Cloudflare publishing remains safely skipped until `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are configured. See [TON-213 Pages runbook](docs/deployment/TON-213-cloudflare-pages.md).

## Verification

GitHub Actions runs generated map/asset drift, asset/content validation, strict typecheck/lint, 127 unit tests across 24 files, production build validation and two serialized browser phases:

- 13 Chromium regressions on the dedicated E2E bundle;
- two end-to-end farm-loop tests on the rebuilt production bundle.

Browser evidence covers invalid-action feedback, autosaved reload during the loop, real multi-day crop growth, harvest/sale, completed-state recovery, touch tutorial skip, inventory binding, shop economy, player lifecycle, benchmark, day transition, save recovery and responsive composition. Production bundles are scanned to ensure technical diagnostic harnesses are absent.

The current scaffold intentionally ships Phaser in the initial game bundle. Bundle splitting and production loading budgets are tracked by `TON-224`.

## Project links

- [Game documentation](https://app.notion.com/p/3afb6030d8e281388eebfa697607e784)
- [Linear project](https://linear.app/tony-football/project/hh-farm-e73470525741)
