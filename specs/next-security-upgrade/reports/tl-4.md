# TL report 4 — next-security-upgrade (FIX round, reports/qa-1.md)

## Outcome
All blocking findings routed and closed. Browser gate now serially verified on
all 5 projects; qa-2 documented as deferred env-class with evidence.

## Fix leaves (spec/fix-qa-1.md, preflight PASS x2)
| Leaf | Finding | Status | Changed/created files | Evidence |
|---|---|---|---|---|
| qa1-01 | qa-1 HIGH | done-verified | `logs/e2e-verify-{webkit,mobile,tablet}.log` + `logs/e2e-verify-r4-verdict.md` (new) | webkit 121p/1f, mobile 122p/1f, tablet 122p/1f; all 3 residuals env-class (login/timeout under remote-Supabase load), each recovered on a single serial rerun (8/8, 1/1, 2/2). `#/aging did not rewrite` + toBeVisible/a11y/nav signatures all pass post-fix. Verdict GREEN. |
| qa1-02 | qa-2 MED | done | `reports/deferred-qa2.md` (new) | Documents StrictMode double-mount -> duplicate `GET /api/prod/analytics` 500 as load-correlated env-class (S01-12 serial pass, S01-14 non-recurrence); future fix site `use-page-data.ts`/route; disposition deferred — PM scheduling. |
| qa-3 LOW | — | deferred-done | TRACKER only | Noted refresh.css reached HEAD via parallel commit 7511b13; end-state verified. |
| qa-4 LOW | — | deferred | none | 11 regenerated e2e PNGs left uncommitted, excluded from change set. |

## Scope check
`git status --porcelain` on src/e2e/tests/playwright.config/manifests: only
pre-existing `M admin-page.tsx` (S01-13 Toggle fix, documented in qa-1.md).
Zero source/test/config edits by these leaves.

## Notes for PM / reviewer DELTA
- qa-1 closable: all 5 projects now have post-fix serial evidence (r3:
  chromium+firefox; r4: webkit+mobile+tablet).
- qa-2 disposition = documented deferred env-class per task instruction; a
  real dedupe fix remains schedulable (S01-12 re-shard row, pending PM).
- Long wall-clock times in logs (54m/11.8h test durations) are host-suspension
  stalls, not test runtime; affected tests passed on rerun.
