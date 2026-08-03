# TON-231 — Stabilization reset

HH Farm is an internal technical preview, not a release candidate.

## Confirmed product gaps

- Farming commands currently run against a detached DOM mini-plot instead of the Phaser world.
- `FarmScene` still contains debug collision/farmable outlines and static soil prototypes.
- `PlayerController` requires keyboard input and has no production touch movement path.
- The portrait layout compresses a 390 px wide canvas to roughly 219 px height.
- Several labels and actions fall below mobile readability and 44 px touch-target guidance.

## Delivery order

1. TON-232 — integrate authoritative farm tiles, targeting, commands, rendering and save state into the world.
2. TON-233 — add semantic touch movement and context action controls.
3. TON-234 — rebuild portrait layout around a readable game world.
4. TON-235 — remove debug prototypes and add in-world feedback.
5. TON-236 — pass human desktop and real iPhone Safari playtests.

The Vercel URL remains an internal preview until TON-236 is complete.
