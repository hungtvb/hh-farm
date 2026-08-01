# HH Farm

A cozy, browser-first 2D farming game built with Phaser 4, TypeScript and Vite.

## Current milestone

`TON-208 — Define Tiled map contract and load farm test map`

The repository currently contains the technical foundation and a validated test farm map. Gameplay, production assets and deployment are tracked separately in Linear.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Commands

```bash
npm ci
npm run dev
npm run check
npm run test:e2e
npm run preview
```

`npm run check` executes type checking, linting, unit tests and a production build. `npm run test:e2e` boots that production build in Chromium and verifies the active farm map.

## Architecture

```text
src/
├── domain/   # Pure TypeScript game rules. Must not import Phaser.
├── game/     # Phaser bootstrap, scenes, world loading and render/input adapters.
├── data/     # Typed content catalogs, Tiled contracts and validation.
└── ui/       # Browser UI overlays and presenters.
```

The domain and data validation layers are intentionally isolated from Phaser so farming rules, content contracts and save migration can be tested without booting a renderer.

## World authoring

The test world is exported from Tiled as orthogonal JSON. Required layer names, object properties and stable identity rules are documented in [Farm map contract v1](docs/maps/farm-map-contract.md).

Tiled numeric object IDs are editor metadata and must not be used as persistent game identity. Object layers use globally unique semantic `stableId` properties instead.

## Verification

GitHub Actions runs `npm ci`, typecheck, lint, unit tests, a production build and a Chromium FarmScene smoke test for pull requests and pushes to `main`.

The current scaffold intentionally ships Phaser in the initial game bundle. Bundle splitting and production asset-loading budgets are handled by `TON-224` after the core technical spike.

## Project links

- [Game documentation](https://app.notion.com/p/3afb6030d8e281f49adce6779de18f4c)
- [Linear project](https://linear.app/tony-football/project/hh-farm-e73470525741)
