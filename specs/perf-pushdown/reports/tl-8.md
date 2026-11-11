# tl-8 — FIX round for reports/ux-1.md (ux-1..ux-3, all blocking per PM)

## Changed files (DELTA scope for reviewer)
- `src/features/cx-hub/components/ecosystem-dynamic.tsx` — `ssr:false` loading fallback now renders `div.eco3-page` (fixed viewport cover, pointer-blocking) containing `.eco3-page-msg[role="status"]` with `Loading the ecosystem…` plus `header.eco3-head > h1` (heading/landmark parity with pre-change SSR).
- `src/features/cx-hub/components/ecosystem-page.tsx` — loader copy `Loading the ecosystem…` at :31 and :142 (verbatim-identical across all 3 loader sites).
- `tests/perf/ecosystem-dynamic.test.ts` — new fallback-shape case (cover + `role="status"` + ellipsis copy).

## Findings status
| Finding | Leaf | Status |
|---|---|---|
| ux-1 MED (no cover / pop-in) | ux1-01 | done — fixed cover + h1 restored |
| ux-2 MED (no `role="status"`, WCAG 4.1.3) | ux1-01 | done — bundled per report |
| ux-3 LOW-blocking (copy `…`, sync all sites) | ux1-01 | done — 3 sites verbatim |

## Gates (round 12, targeted per leaf scope)
- `npx vitest run tests/perf/ecosystem-dynamic.test.ts` — PASS 3/3
- `npx eslint` on 3 touched files — 0 errors
- TL verified scoped diff (~+20 lines); unrelated hunk in ecosystem-page.tsx
  (`Admin, Connected apps` → `Admin, Settings`) predates this leaf (baseline dirty tree).

## Notes for reviewer / PM
- No-JS, contrast/reflow "not verified" items in ux-1.md are assumptions, not findings.
- Report's hygiene note: stray `tmp-lint-fixture.tsx` no longer exists in the working tree.
- Sibling-spec overlap note stands: `narrow` prop removals belong to ux-ui-audit-v3, untouched here.
- No shards requested non-spawnable reviewers; none spawned.
