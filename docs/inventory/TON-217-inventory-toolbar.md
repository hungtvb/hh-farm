# TON-217 — Inventory, toolbar and item transactions

## Outcome

HH Farm now has one authoritative player-items aggregate:

- a fixed 12-slot inventory;
- an eight-slot toolbar;
- atomic item add/remove transactions;
- catalog-backed stack limits and presentation;
- pointer, keyboard and touch interaction.

Drag-and-drop, sorting and storage expansion are intentionally deferred.

## Ownership

```text
Content catalog
  supplies item identity, category, sprite and stack limit

InventoryState
  owns item stacks and quantities

ToolbarState
  owns eight item-ID bindings and selected slot

PlayerItemsState
  coordinates inventory transactions with toolbar cleanup

Presenter
  projects immutable view models and localized labels

HUD / inventory modal
  renders view models and emits select/bind intents only
```

The DOM never mutates quantities or toolbar bindings directly. The composition root executes domain operations and re-presents the resulting aggregate.

## Inventory contract

`InventoryState` always contains exactly 12 slots. Each occupied slot contains a normalized item ID and a positive integer quantity.

Adding an item:

1. validates quantity and stack limit;
2. calculates total capacity before changing state;
3. fills existing stacks of the same item first;
4. fills empty slots in ascending slot order;
5. either commits the complete quantity or returns `inventory_full` with the original state reference.

Removing an item validates that the complete requested quantity exists before changing state. Removal walks slots in ascending order and converts a zero-quantity stack back to `null`.

Failed transactions emit no partial result and preserve the original aggregate.

## Toolbar contract

The toolbar has exactly eight bindings. A binding stores an `itemId`, not an inventory slot index or a duplicate quantity. Its displayed quantity is derived from the total item quantity in inventory.

Consequences:

- moving or splitting an inventory stack does not invalidate toolbar bindings;
- the same item may be bound to multiple toolbar slots;
- consuming the final item clears every binding for that item;
- clearing bindings does not change the currently selected slot;
- selecting or binding an invalid slot is rejected atomically.

## Farming integration

Farming commands consume the shared inventory port. Seed use and harvest capacity therefore use the same transaction behavior as future shop/economy operations:

- planting consumes exactly one seed only after command preconditions pass;
- harvest fails with shared `inventory_full` semantics when the complete predetermined yield cannot fit;
- command failures leave both field and player items unchanged.

## Initial player items

The initial state is built from the validated content catalog:

| Toolbar slot | Item | Quantity |
| --- | --- | ---: |
| 1 | Hoe | 1 |
| 2 | Watering Can | 1 |
| 3 | Turnip Seeds | 5 |
| 4 | Carrot Seeds | 3 |
| 5 | Strawberry Seeds | 2 |
| 6–8 | Empty | 0 |

UI labels are localized at the presentation boundary. Catalog IDs and source display names remain unchanged.

## Controls and accessibility

- `1–8`: select a toolbar slot while the inventory is closed.
- `I`: open or close the inventory.
- `Escape`: close the inventory.
- Pointer/touch: select a toolbar slot, open the inventory and bind an item to the selected slot.

The modal is an accessible dialog with an explicit title, close control, focus handoff and per-slot labels containing item, quantity and binding destination. Desktop uses a centered panel; portrait mobile uses a compact safe-area-aware bottom sheet.

## Verification

The automated contract covers:

- fixed slot counts and construction validation;
- existing-stack-first addition;
- deterministic empty-slot allocation;
- atomic full/insufficient/invalid failures;
- removal across multiple stacks;
- final-item cleanup of duplicate toolbar bindings;
- farming adapter capacity and consumption behavior;
- catalog-backed initial state and localized presentation;
- desktop keyboard/pointer interaction;
- mobile touch binding and compact viewport composition;
- existing movement, day-transition, save recovery, benchmark and visual-shell regressions.
