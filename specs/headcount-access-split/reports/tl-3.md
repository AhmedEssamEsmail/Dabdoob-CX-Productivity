# TL report 3 — headcount-access-split (EXTEND round, S10)

Round scope: verify + gate leaves S10-01 and S10-02 (both Owner: dev, already reported done).

## Leaves verified

| Leaf | Status | Evidence |
|---|---|---|
| S10-01 (E1 dq-holform) | done | results/S10-01.md. Diff confirmed: single `:root .dq-holform` rule only (+1/-1 lines vs budget 6) — col2 `11rem`→`minmax(12rem,14rem)`, col3 `1.4fr`→`minmax(10rem,20rem)`, `max-inline-size:52rem` added; `.cx-error` span + ≤900px stack untouched. Worker caveat: pixel check is CSS-bounds only, no live render — flag to ux/qa gate. |
| S10-02 (E2+E3 admin settings) | done | results/S10-02.md. All 5 files, diffs in-contract only (+27/-65 ≈92 lines vs est 70 — overage is the mandated `html[data-reduce-*]` block deletions, not scope creep). `Rb` save flow reused verbatim on `cx-switch` markup (input immediately precedes `__track`); `Toggle` import removed; `iu`/`Appearance`/`APPEARANCE_DEFAULTS`/`applyAppearance`/`APPEARANCE_BOOT`/`theme.css`/`BootSplash` writers all removed; `prefers-reduced-*` media queries + inert `hasAttribute` readers retained. Greps: `data-reduce-transparency` = 0 in src; `data-reduce-motion` = readers only, no writers (index.html clean). |

## Gates this round (logs/)

- `npx tsc --noEmit` → exit 0 (gate-tsc-3.log)
- `npx eslint` on 6 edited files → exit 0; 1 warning `local/no-raw-controls` at admin-page.tsx:342 — expected/contract-mandated (`cx-switch` has no ui/ primitive per spec Context); 2 css file-ignored warnings (gate-eslint-3.log)
- `npx vitest run tests/golden/hub-people-holidays.test.ts tests/golden/hub-admin.test.ts` → 26/26 pass (gate-vitest-3.log)

## State

All spec leaves done (S01–S10). Still open for PM/user: S07-01 real backfill run needs NEEDS_APPROVAL (remote DB write); e2e suite has pre-existing instability unrelated to this work (gate log r2); repo dirty tree also carries other specs' edits — scope checks here used S10-assigned files only.
