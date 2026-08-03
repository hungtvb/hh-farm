# TON-218 — Wallet, shop and buy/sell economy

## Outcome

HH Farm now has one production economy state that coordinates:

- a non-negative safe-integer wallet;
- the authoritative player inventory and toolbar;
- catalog-backed shop offers and sell prices;
- atomic buy and sell transactions;
- responsive pointer and touch presentation.

## Ownership

```text
Validated content catalog
  owns item identity, stack limit, sell price, offer quantity,
  buy price and unlock day

WalletState
  owns the current coin balance

PlayerItemsState
  owns inventory stacks and toolbar bindings

EconomyState
  commits wallet + player items together

Shop presenter
  derives price, lock, capacity and affordability view models

Shop UI
  renders view models and emits buy/sell intents only
```

The shop DOM never subtracts coins, changes quantities or reimplements capacity rules. The composition root invokes the pure transaction domain and presents the resulting immutable state.

## Wallet contract

Wallet coins are non-negative JavaScript safe integers. Debit and credit amounts must be positive safe integers.

Failures preserve the original wallet reference:

- `invalid_coin_amount`;
- `insufficient_funds`;
- `coin_overflow`.

An exact-balance debit is valid and leaves zero coins.

## Buy transaction

`buyShopOffer` validates the complete command before commit:

1. purchase count and current day are positive safe integers;
2. the offer exists and is unlocked;
3. the referenced item exists;
4. multiplied quantity and cost remain safe integers;
5. the wallet contains the complete cost;
6. inventory can accept the complete quantity;
7. wallet debit and inventory candidate both succeed.

Only then does it create a new `EconomyState` and emit one `item-bought` event. A full inventory never debits coins; insufficient funds never adds inventory.

## Sell transaction

`sellInventoryItem` validates:

1. quantity is a positive safe integer;
2. the item exists and has a positive catalog sell price;
3. the player owns the complete requested quantity;
4. total revenue remains a safe integer;
5. crediting the wallet cannot overflow.

Only then are inventory removal and wallet credit committed together. Selling the final item reuses the player-items rule that clears every matching toolbar binding.

## Shop presentation

The presenter consumes the same transaction engine to determine whether a one-bundle purchase is currently available. It exposes stable disabled reasons:

- `insufficient_funds`;
- `inventory_full`;
- `offer_locked`;
- `item_not_sellable` for sale entries.

Prices and unlock days are never duplicated in UI code. Vietnamese names are applied only at the presentation boundary; catalog IDs and source names remain unchanged.

The initial production economy starts with 250 coins and the catalog-backed inventory from TON-217.

## Interaction

Desktop uses a centered market panel. Portrait mobile uses a safe-area-aware scrollable sheet. The interface provides:

- buy one catalog offer bundle per activation;
- sell one inventory item per activation;
- live coin, inventory, toolbar and disabled-state updates;
- success/error feedback through an ARIA live region;
- keyboard isolation so shop input cannot change toolbar selection or open inventory behind the modal;
- Escape and an explicit close control.

## Persistence boundary

`EconomyState.wallet` is the authoritative coin source in the current production composition. The older day-transition/save spike owns a separate technical `FarmState` fixture and is not mounted alongside that fixture in its E2E route. Mapping the complete economy aggregate into the production save envelope belongs to the end-to-end farm-loop integration; this ticket does not create two mutable coin sources inside the running production experience.

## Verification

Automated evidence covers:

- wallet construction, exact debit, invalid amounts and overflow;
- exact-balance and multi-bundle purchases;
- insufficient funds, locked offers and full inventory;
- sell price, missing ownership, unsellable tools and coin overflow;
- original-state identity on every failed transaction;
- toolbar cleanup after selling the final bound item;
- catalog adapter and shop disabled-state projection;
- desktop buy/sell with live coin and stack changes;
- shop modal keyboard isolation;
- mobile touch purchase and viewport composition;
- all existing movement, farming, inventory, day-transition, save and benchmark regressions.
