# TON-222 — Progression, settings and VI/EN foundations

## Outcome

HH Farm now keeps a small deterministic progression loop after the first harvest while preserving player preferences independently from farm progress.

The first complete turnip loop awards exactly 100 XP and unlocks carrot seeds. Strawberry seeds unlock at 200 XP. Language, music/SFX volume, reduced motion and vibration survive reloads and farm-save resets.

## Progression state

`ProgressionState` is part of the authoritative `FarmLoopState`:

```text
xp
level (1–3)
unlockedCropIds
```

Level and unlock lists are derived from XP rather than edited independently:

| XP | Level | Seeds available |
|---:|---:|---|
| 0–99 | 1 | Turnip |
| 100–199 | 2 | Turnip, carrot |
| 200+ | 3 | Turnip, carrot, strawberry |

## XP policy

Progression observes committed domain events only:

- `seed-planted`: +10 XP;
- `crop-harvested`: +70 XP;
- `item-sold` for produce: +20 XP.

Till, water, day transitions, invalid actions, seed sales and toolbar changes award no XP.

The farm-loop coordinator resolves progression into the same candidate aggregate as farming/economy changes. The order remains:

```text
resolve gameplay + progression candidate
→ autosave complete candidate
→ commit in memory
→ present XP/unlock feedback
```

A save failure keeps the previous state, inventory and XP. Unit coverage specifically verifies failed planting does not consume a seed, create a crop or award XP.

## Shop unlock enforcement

The shop presenter and production buy path share the same progression policy:

- turnip seed requires level 1;
- carrot seed requires level 2;
- strawberry seed requires level 3.

This prevents a UI-only lock where a hidden or scripted purchase could bypass progression. Day-based offer availability and inventory/wallet validation still run after the progression gate.

## Farm save schema v2

The production farm-loop save envelope now stores progression.

Schema v1 remains readable. Migration is deterministic:

- a completed v1 tutorial migrates to 100 XP / level 2 / carrot unlocked;
- all other v1 saves migrate to 0 XP / level 1 / turnip only.

Decoded saves are normalized to a v2 envelope. `FarmLoopSaveRepository` exposes `migratedFrom` so presentation and verification can distinguish a clean load from a migration.

## Player settings

`PlayerSettings` contains:

- language: `vi` or `en`;
- music volume: `0…1`;
- SFX volume: `0…1`;
- reduced motion;
- vibration.

Settings use the versioned localStorage key:

```text
hh-farm:player-settings:v1
```

They are intentionally outside the IndexedDB farm-save database. Deleting or starting a new farm therefore does not erase language or accessibility preferences.

Load outcomes are explicit:

- `default`: no saved settings;
- `loaded`: validated saved settings;
- `recovered_default`: malformed/unsupported data replaced by safe defaults;
- `unavailable`: browser storage blocked, defaults remain usable in memory.

## Localization foundation

A typed flat catalog provides the important production strings in Vietnamese and English:

- tutorial objectives/actions/feedback;
- HUD and inventory shell;
- shop labels, locks and transaction feedback;
- settings and progression labels;
- item names and failure reasons.

Changing language persists settings and reloads the app so every mounted surface uses one translator and one locale. Numbers use `vi-VN` or `en-US` formatting.

The font stack prioritizes system fonts with Vietnamese glyph coverage:

```text
Segoe UI → Noto Sans → Arial → system-ui → sans-serif
```

## Accessibility and responsive behavior

The settings UI follows the shared UI/UX constraints:

- minimum 44 × 44 px interactive targets;
- visible keyboard focus;
- 8 px action spacing;
- safe-area-aware mobile bottom sheet;
- no horizontal overflow;
- reduced-motion preference applied through document state and CSS;
- a CSS water-drop cue replaces emoji UI iconography.

The production document exposes current preferences through data attributes for adapters and browser verification:

```text
data-language
data-reduced-motion
data-vibration
data-music-volume
data-sfx-volume
```

## Verification

Unit coverage verifies:

- XP thresholds and one-time unlock events;
- ignored/no-op events award no XP;
- save failure does not commit XP;
- progression-gated shop presentation;
- v1→v2 farm-save migration;
- settings validation/recovery/persistence;
- Vietnamese/English catalog formatting.

Production-bundle Playwright coverage verifies:

- invalid farm actions leave XP unchanged;
- a complete turnip loop reaches 100 XP and unlocks carrot;
- progression restores after reload;
- language/reduced-motion/audio/vibration settings restore after reload;
- deleting only the farm IndexedDB save does not remove settings;
- mobile settings controls meet the 44 px target and render without replacement glyphs.
