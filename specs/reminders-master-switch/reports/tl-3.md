# TL report 3: reminders-master-switch (FIX round 2, source: reports/ux-1.md)

## Routed findings (all MED -> dev, serial on one file)
- ux-1 -> RMS-F05. `Dm` dropped its `useState(initial)` rows copy; signature is
  now `{rows, onSaved}` mirroring `Rb`, both save paths (Pm `onSaved`, boolean
  "Set to …" toggle) call `onSaved(u)`; call site `<Dm rows={r} onSaved={a} />`.
  AdminPage `r` is the single source of truth — either block's save updates both.
- ux-2 -> RMS-F06. `Rb` renders "Loading…" while `rows === null` and the
  toggle is `disabled={busy || !row}` — no enabled control on the `true` guess.
- ux-3 -> RMS-F07. `Rb` toggle gained `aria-label="Turn reminders off|on"` +
  `aria-pressed={on}`; visible text unchanged.

## Changed files (fix scope only)
`src/features/cx-hub/components/admin-page.tsx` — ~12 handwritten lines across
the three leaves (Dm region + Rb region + one call site). No stray edits; the
larger diff vs HEAD is the still-uncommitted RMS-08 baseline (Rb block itself).

## Gates (round 4)
- `npx tsc --noEmit` PASS · `npx vitest run` PASS 1152/1152 (53 files) ·
  scoped `npx eslint admin-page.tsx` 0 errors (5 pre-existing warnings in the
  untouched `Tm` region).
- e2e not re-run: still red for foreign in-flight redesign work; no fix file
  implicated.

## Handoff to PM
- DELTA scope for UX re-review: admin-page.tsx `Dm` (~109-197), `Rb`
  (~371-405) and the `<Dm rows={r} onSaved={a} />` call site (~449).
- Pending: PM's single `git commit` step; e2e decision unchanged.
