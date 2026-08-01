# HH Farm

A cozy, browser-first 2D farming game built with Phaser 4, TypeScript and Vite.

## Current milestone

`TON-207 — Bootstrap Phaser 4 + Vite 8 TypeScript architecture`

The repository currently contains the technical skeleton only. Gameplay, production assets and deployment are tracked separately in Linear.

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer

## Commands

```bash
npm ci
npm run dev
npm run check
npm run preview
```

`npm run check` executes type checking, linting, unit tests and a production build.

## Architecture

```text
src/
├── domain/   # Pure TypeScript game rules. Must not import Phaser.
├── game/     # Phaser bootstrap, scenes, render/input adapters.
├── data/     # Typed content catalogs and fixtures.
└── ui/       # Browser UI overlays and presenters.
```

The domain layer is intentionally isolated from Phaser so farming rules, inventory, economy and save migration can be tested without booting a renderer.

## Verification

GitHub Actions runs `npm ci` followed by `npm run check` on the feature branch and pull requests targeting `main`.

The current scaffold intentionally ships Phaser in the initial game bundle. Bundle splitting and production asset-loading budgets are handled by the dedicated performance milestone after the core technical spike.

## Project links

- [Game documentation](https://app.notion.com/p/3afb6030d8e281f49adce6779de18f4c)
- [Linear project](https://linear.app/tony-football/project/hh-farm-e73470525741)
