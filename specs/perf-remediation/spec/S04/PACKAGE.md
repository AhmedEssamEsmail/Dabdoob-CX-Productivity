# S04: Batched writes — updateRows and resolvePopups
Kind: package
ID: S04
Dispatch: NEVER

## Goal and contract
PLAN criterion #4: `updateRows` currently issues find+update (2 PostgREST
calls per ROW); it must batch to <=2 calls per batch (one `.in()` read for
currents + one upsert, per-row fallback kept for tables without a usable
conflict key). `resolvePopups` must end its per-row write loop — one
filtered `.update()` call. The popups leaf also lands the criterion-#3
popups filtering (same file). Invariants: `updateRows`/`updateRow`
signatures and per-entry null semantics unchanged; guard runs against each
current row exactly as today; submitted_* stamps still unstrippable.
Non-goals: other repo helpers, popupsPoll count stamp design.

## Children
Index: `S04/00-index.md`
- updateRows batch + test: S04-01 | popups filtered reads + bulk resolve: S04-02

## Completion
Both done; repo tests + golden popup/reminder suites green.
