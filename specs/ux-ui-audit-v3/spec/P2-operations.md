# P2-OPS — cx-operations routes (package)

Kind: package. Dispatch: NEVER. Covers routes rendering
`src/features/cx-operations/components/*` (operations group), plus the unbuilt
operations registry path served by the `[...slug]` catch-all.

## Children

| id | owner | routes | depends | criteria | budget |
|----|-------|--------|---------|----------|--------|
| P2-OPS-01 | ux-ui-expert | 2 (1 built + 1 placeholder) | none | PLAN Phase 2 | files=1+evidence; actions=2; changed_lines=0; minutes=10 |

## P2-OPS-01: Audit cx-operations routes (2 URLs) at 375/768/1024/1440

Kind: mini (audit — read-only; no source edits)
ID: P2-OPS-01
Parent: P2-OPS
Owner: ux-ui-expert
Depends: none
Criteria: PLAN Phase 2 (8-question page contract)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md; C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1 (+screenshot evidence); actions=2; changed_lines=0; minutes=10

### Goal
Produce a PASS/FAIL verdict with screenshot evidence for every route below,
at every viewport, against the 8-question contract.

### Routes
| URL | Login as | Notes |
|-----|----------|-------|
| `/trackers` | e2e.admin | Multi-tracker page (blocked customers, promocodes, loss, strikes) — exercise tracker switcher once for Q1/Q8 |
| `/escalation-matrix` | e2e.admin | **Unbuilt** — placeholder quick-check only (375 + 1440): designed `UnbuiltPage` renders, not 404/error; full checklist runs once in P2-SH-01 |

### Environment
1. Seed once (idempotent): `npm run test:e2e:seed` → fixture users
   `e2e.admin@` / `e2e.tl@` / `e2e.agent@dabdoob.com`, password
   `E2E-cx-local-2026!` (override `$E2E_USER_PASSWORD`). See `e2e/users.ts`.
2. `npm run dev` → `http://localhost:3000`. All pages gated by `src/proxy.ts`
   + roster role.
3. Sign in via `/auth/login` or `login(page, E2E_USERS.admin)` (e2e/users.ts).
4. Per viewport: `page.setViewportSize({ width, height: 900 })`,
   width ∈ {375, 768, 1024, 1440}.

### Checklist — answer per route per viewport (PASS/FAIL)
1. Header/toolbar stays put across loading → loaded → error → empty states
   (click refresh/toggle; anything jump?)
2. Every control is a shared component, labeled, keyboard-focusable, visible
   focus ring
3. No unstyled/raw links, buttons, inputs, or leftover legacy UI
4. No overflow, overlap, clipped text, or horizontal scroll at any width
5. Empty/loading/error states exist and look designed (not a raw string)
6. Spacing/typography consistent with the `--cx-*` scale; no hardcoded values
   visible in DOM styles
7. Heading hierarchy sane; landmark regions present (nav, main, labelled
   sections)
8. Interactive states distinct: hover, disabled, selected, active, error

### Audit rules
- For Q1 exercise the page's primary action/refresh once; for Q4 also confirm
  `document.documentElement.scrollWidth <= window.innerWidth`.
- Trigger error/empty states only via existing UI controls — never edit source.
- Fixture role bounced to `/` or `/auth/login` → record **BLOCKED**, not FAIL.
- Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/operations/<route>-<w>.png`
  (`fullPage: true`); every FAIL needs a shot at the failing width.

### Files
- Create: `specs/ux-ui-audit-v3/results/ux3-operations-1.md` | audit evidence table

### Evidence format (`results/ux3-operations-1.md`)
```
# UX3 audit — operations shard 1 — <date> — ux-ui-expert
Env: npm run dev @ :3000, e2e seed users, chromium
| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
## /<route> — PASS|FAIL|BLOCKED|PLACEHOLDER
- Q1..Q8: PASS/FAIL — one-line note each (built routes only)
- FAIL: what, where (selector/region), width, screenshot path,
  severity blocker|major|minor, suspected Phase-1 class (A1-A7/B1-B18) if any
```

### Context
- `e2e/users.ts:41-70` | `login()` helper + fixture identities
- `specs/ux-ui-audit-v3/PLAN.md:58-79` | Phase-2 contract wording
- `src/app/[...slug]/page.tsx` | catch-all → `UnbuiltPage` for unbuilt paths

### Contract
Read-only: no file under `src/`, `e2e/`, or `supabase/` may be modified.
Out of scope: fixing findings; the shared `UnbuiltPage` full checklist
(P2-SH-01).

### Actions
1. Audit `/trackers` at 4 widths (include tracker-switcher stability check).
2. Placeholder quick-check `/escalation-matrix` at 375 + 1440.

### Done when
- `results/ux3-operations-1.md` has a complete row per route.
- Every FAIL cites width, selector/region, screenshot path, severity.
- Screenshot files referenced in the table exist on disk.

### Verify
- Run: `dir specs\ux-ui-audit-v3\results\ux3-operations-1.md specs\ux-ui-audit-v3\results\ux3-screens\operations` -> evidence file + screenshots present; 2 route rows.

### Handoff
FAIL lines → fix shards via `spec/P2-fix-template.md`. PASS rows count toward
PLAN exit criterion 2.
