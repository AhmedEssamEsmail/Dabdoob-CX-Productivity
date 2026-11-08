# qa report - reminders-master-switch - round 3 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/1L

Checks run:
- `npx tsc --noEmit` -> clean, 0 errors
- `npx vitest run` -> 1152/1152 pass (53 files)
- `npx eslint src/features/cx-hub/components/admin-page.tsx` -> 0 errors, 5 warnings (unused eslint-disable directives at 323-359, untouched `Tm` region, pre-existing)
- e2e: not run — still red for foreign in-flight redesign work per tl-2/tl-3; admin-page.tsx is the only changed file and no e2e spec covers Admin.
- `git diff admin-page.tsx` inspected in full: only the `Dm` rows-prop refactor, the `Rb` block (uncommitted RMS-08 baseline + ux fixes), and the call sites — no stray edits.

Delta verification (qa-2 open findings vs tl-3 changed file):
- qa-3 LOW -> FIXED. admin-page.tsx:381 renders "Loading…" while `rows === null`; toggle is `disabled={busy || !row}` (line 385) — no enabled control on the `on=true` guess, so the flash of a live "Turn off" is gone.
- qa-4 LOW -> CLOSED. Criterion-2 Admin block evidence now supplied by the UX/UI gate: ux-2.md PASS verified loading/error/success/disabled/keyboard states of `Rb` and the `Dm` sync path by code audit (per qa-2's "rely on UX/UI gate" option). Still no automated component test — acceptable; the toggle's save path is the already-covered `saveConfigSetting`.

Regression check on changed file:
- `Dm` refactor is sound: filter/map read the `rows` prop (118, 139); both save paths call `onSaved(u)` — `Pm` editor (150-153) and boolean "Set to …" toggle (169); call site `<Dm rows={r} onSaved={a} />` (450) keeps `r` as single source of truth so `Rb` and `Dm` stay in sync on either save path. Local `i`/`r`/`o` view-state unaffected; editor still closes via `a('')` after save.
- `Rb` aria additions (386-387): `aria-label` disambiguates among page toggles; `aria-pressed` reflects `on` — true on the disabled loading state is harmless.
- No debug leftovers, TODOs, or new dependencies in the diff.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| ux-4 | LOW | src/features/cx-hub/components/admin-page.tsx:374,381,385 | Carried from ux-2 (logged for tracking): if `rows` loads without a `reminders_enabled` row (shouldn't happen — CONFIG_DEFAULTS merges it), block shows "Reminders are on" with a permanently disabled toggle and no explanation. | When `rows !== null && !row`, render "Setting not found" instead of the on/off status. | dev |

Not verified / assumptions:
- e2e gate remains unverified (foreign redesign failures); re-run after that work integrates.
- ux-4 is speculative — depends on `getConfigRows` omitting the default; no evidence it can occur.
- Pending per tl-3: PM's single `git commit`; e2e decision unchanged.
