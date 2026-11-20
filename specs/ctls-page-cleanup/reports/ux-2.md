# ux report - ctls-page-cleanup - round 2 (DELTA)

Verdict: PASS
Open: 0/0/0/3

Scope reviewed (reports/tl-3.md FIX round, DELTA):
`src/features/cx-quality/components/ctls-page.tsx` — `findOpenCtls`
predicate (~L34-41) only. Prior FULL review: reports/ux-1.md.

States checked: ref-lookup match / no-match hint (L141, L203),
multi-match Seg picker (L186-201), auto-pick on single match (L127),
submit path unchanged. Keyboard/focus/dark/responsive: no deltas vs
round 1 — one predicate line added, no markup/style change.

## Prior findings — verification

| ID | Sev | Status | Evidence |
|---|---|---|---|
| ux-1 | MED | FIXED | `findOpenCtls` now filters `c.status === 'open' && c.canClose && …` (ctls-page.tsx:36-37). In 'all' scope, typing another team's ticket (or any non-closeable open CTL) yields `y === null`, so the side panel stays "No audit selected" and submit resolves to the existing inline error "No open CTL of yours matches that…" (L141) / muted hint (L203) instead of the dead-end server reject at server.ts:1281. Ref path now mirrors the per-row `r.canClose` button gate; server check remains as defence in depth. Input is preserved on error, error is inline and adjacent to the field — behaviour consistent with the rest of the form. |
| ux-2 | LOW | OPEN (deferred) | Empty-state copy still says "an audit of your agent loses marks" under 'all' scope (~L462). Deferred per tl-3 LOW rules. |
| ux-3 | LOW | OPEN (deferred) | Meta line "shown to you because you were on shift when it opened" still false under 'all' (~L416); same root as deferred qa-2. |
| ux-4 | LOW | OPEN (deferred) | No busy affordance on list during scope refetch (~L349-352); logged-only, matches sibling actMode — fix both pages together if ever done. |

## New observations (this delta)

- With `canClose` in the predicate, a ticket that has 2 open CTLs where only
  1 is closeable collapses to `g.length === 1` and auto-picks it (L127) —
  the correct UX; the "choose one" Seg only appears when ≥2 closeable CTLs
  share the ticket.
- Copy nit (folds into ux-2/ux-3 class, no new finding): the no-match hint
  "No open CTL of yours matches" is slightly loose under 'all' scope but is
  pre-existing phrasing and directionally right — only CTLs closeable by the
  current user can match now, i.e. effectively "yours" to act on.

## Verified OK

- Single-line predicate change; no new components, tokens, colours, or
  geometry — consistency/dark-mode/contrast posture unchanged from round 1.
- Ambiguity branch `g.length > 1` → 'Choose which CTL of this ticket.'
  still reachable and correctly gated by the picker.

Not verified / assumptions:
- No Playwright run — change is one predicate line; layout/behaviour judged
  from code (webapp-testing not needed).
- web-design-guidelines fetch not performed (no fetch tool in this env);
  applied general guideline checks to the changed lines — nothing to flag.
