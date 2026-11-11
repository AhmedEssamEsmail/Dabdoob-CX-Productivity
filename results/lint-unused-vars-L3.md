# lint-unused-vars L3 — DONE

Fixed all 28 `no-unused-vars` warnings across the 8 shard files (queue-core.ts already clean; its uncommitted WIP untouched).

## Files changed
- `src/features/cx-desk/lib/tlperformance.ts` — dropped 4 dead time imports (pwAddDays/pwDateOnly/pwKwDate/pwKwTime).
- `src/features/cx-people/lib/scorecard/index.ts` — dropped dqKeyPart_/dqNormCell_/pwToday_ from adapters import.
- `src/features/cx-people/lib/work-core.ts` — removed unused `readRows` import.
- `src/features/cx-productivity/lib/prod/validation.ts` — dropped dead prodNorm/prodIn imports (local `_` versions exist); consumed trailing parity params (`String(_reason)`/`String(_statuses)`/`String(_agentHistory)`) — `args: after-used` clears the rest; signatures/exports unchanged.
- `src/features/cx-queue/lib/index.ts` — dropped dqKeyPart_ import.
- `src/features/shared/jobs/mirrors.ts` — dropped prodFileFor_ import + dead MAQSAM_MONTH_TAB const (API fetch superseded sheet tab).
- `src/features/shared/platform/popups.ts` — `actor` kept (10 callers pass 3 args; no resolver column) — consumed via `String(actor)` + comment.

## Checks
- `npx eslint` on 8 files: 0 warnings.
- `npx tsc --noEmit`: clean (EXIT:0).
- `npx vitest run tests/golden`: 27 files / 876 tests pass.

Note: config has no `_` ignore pattern, so `_`-prefixed params still warn — trailing unused params are consumed once instead (no eslint-disable used).
