# tl-8 — FIX round 5 (mockup-parity gate, ux-parity.md)

**Status: all blocking diffs dispatched and merged; checkpoint-fix5 gates green.**

## Leaves (10 mini, all done)

| Leaf | Finding | Files changed | Evidence |
|---|---|---|---|
| PX-01 | B1 topbar on all shell pages | **new** `shell/Topbar.tsx`; `AppShell.tsx`; `Popups.tsx` (reopenTick + onPendingChange) | results/PX-01.md; live probe: `.topbar` = first child of `#main`, crumbs `Group / <b>Page</b>` (overview `<b>` only), bell `.dot` ↔ pending popups, appearance cycles+persist, avatar initials — 7/7 routes |
| PX-02 | H4 Export + L queue-search-in-head | `queue-page.tsx` | results/PX-02.md; head aside = `.input` search + Export `.btn btn-quiet` (CSV of filtered rows, blob download, no endpoint) + RefreshNow; `CxFilters` row removed |
| PX-03 | H7a seg + L avatar chips | `status-validation-page.tsx` | results/PX-03.md; `Open/Reviewed/Disputed` `.seg` in `.page-actions` (live counts, aria-pressed, per-view sections, empty states); `.avatar` initials in `.pv-item`; `selected` cleared on switch |
| PX-04 | M7 Score-effect + H7b | `api/prod/flags/[flagId]/route.ts`; `status-validation-page.tsx` | results/PX-04.md; `scoreEffect` = flagged_min/dayMin via `prod_intervals` (null-safe); 3-stat grid above FlagStrip; **H7b = documented divergence** (`case_ids_json` holds [id,channel] pairs only — no per-case Touches/Dur/Evidence store; PARITY comment in code) |
| PX-05 | H9 tab order | `tph-grid-page.tsx` | results/PX-05.md; `Ga` `summary` slot after `<Ya>`; DOM = head→tabs→note→stats→panels |
| PX-06 | M2 Team pulse + L ecosystem row | `aggregates.ts`; `overview-page.tsx` | results/PX-06.md; `out.pulse` (sc_daily→prod_daily_layers→fcr_daily cascade, scoped like `oldest`, 7d); 4 hbar rows; Ecosystem section removed. **Divergence:** adherence has no data source → `null`/`–` |
| PX-07 | M3 Week + Book-focus CTA | `my-day-page.tsx` | results/PX-07.md; seg `today|week` + head `Book focus block` (earliest open gap → `createFocusBlock` → reload). **Divergence:** 'Week' = the API's 2-day window; wider range needs an API change |
| PX-08 | M5 aging band-ladder | `aging-page.tsx` | results/PX-08.md; duplicated `AgeLadder` `cx-section` dropped; distribution card → matrix card → list |
| PX-09 | M8 date-input width | `agents-page.tsx` | results/PX-09.md; `9.5rem` inline on `sc-from`/`sc-to` (mock's exact approach) |
| PX-10 | golden-oracle `pulse` key | `tests/golden/hub-overview.test.ts` | results/PX-10.md; `D-PULSE` seam (`dropPulse_` on port envelope) + shape assertion — same pattern as S01-05 D-BRAND |

## Remaining finding — no code change (documented divergence)

- **L "insight chip bottom-left orange"** — probed live (`probe-portal.json`):
  the element is `<nextjs-portal>` → `.nextjs-toast` **"0 1 Issue"** — the
  Next.js **dev-overlay error badge** (shadow DOM, dev-server only), not
  app UI and absent from production builds. The app's real toast system
  (`.toasts`/`.toast`) is already bottom-right with `--cx-ink` dark bg =
  mock `.toast` anatomy. Nothing to move.
- **L agents-list avatar chip** — already shipped in FUX-12
  (`agents-page.tsx` `.avatar` initials in the rank table); PX-03 covers
  the flag-list chips on /status-validation.

## Integration gates (checkpoint-fix5)

- `npx tsc --noEmit` → clean · `npx eslint . --quiet` → 0 errors
- `npx vitest run` → 1117/1117 (PX-10 fixed the 6 oracle fails caused by
  the intentional additive `pulse` key)
- `npm run test:e2e` → 95 pass / 10 skip / **0 fail** (clean run, no
  remote-auth flakes this time)
- Live probe (`.devin/work/probe-topbar.mjs`): `.topbar` verified inside
  `#main` with correct crumbs + 3 right controls on all 7 probed shell
  routes; login/state-screens untouched by design.

## Notes for the re-gate

- Serialisation kept: PX-03 → PX-04 (same file); all other leaves disjoint.
- Foreign in-flight edits present in the tree (api/platform/tests/migrations
  from another effort) — left untouched; scope checks used assignment-local
  diffs only.
- No reviewer shards requested or spawned; mockup-parity re-gate belongs to
  the PM (ux-ui-expert).
