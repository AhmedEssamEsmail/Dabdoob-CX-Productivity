# S05-04: my-audits + my-auditor-kpis — head/card/empty normalization
Kind: mini
ID: S05-04
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`my-audits-page.tsx` and `my-auditor-kpis-page.tsx` take the shared
patterns (agent-facing pages — `.empty` copy stays `D()`-friendly).

## Files
- Edit: `src/features/cx-quality/components/my-audits-page.tsx` | head + audit list/detail sections
- Edit: `src/features/cx-quality/components/my-auditor-kpis-page.tsx` | head + KPI sections

## Context
- `mockups/pages/10-my-status.html` | agent-facing card/empty reference
- the two page files | current heads + list/detail sections

## Contract
- Heads one-line; audit lists/details framed as `.card`; statuses →
  `.pill`/`data-status` chips; empty branches → `.empty`; `D()` kept; no
  logic changes; do not edit styles/quality.css.

## Actions
1. my-audits: head + card framing.
2. my-audits: pills + `.empty`.
3. my-auditor-kpis: head + card framing.
4. my-auditor-kpis: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-04.md (<=10 lines); TL alone updates TRACKER.md.
