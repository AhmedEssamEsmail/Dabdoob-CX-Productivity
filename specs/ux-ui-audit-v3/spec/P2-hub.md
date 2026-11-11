# P2-HUB — cx-hub routes (package)

Kind: package. Dispatch: NEVER. Covers routes rendering
`src/features/cx-hub/components/*-page.tsx` (hub group in the registry).

## Children

| id | owner | routes | depends | criteria | budget |
|----|-------|--------|---------|----------|--------|
| P2-HUB-01 | ux-ui-expert | 7 | none | PLAN Phase 2 | files=1+evidence; actions=7; changed_lines=0; minutes=10 |

## P2-HUB-01: Audit cx-hub routes (7 URLs) at 375/768/1024/1440

Kind: mini (audit — read-only; no source edits)
ID: P2-HUB-01
Parent: P2-HUB
Owner: ux-ui-expert
Depends: none
Criteria: PLAN Phase 2 (8-question page contract)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md; C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1 (+screenshot evidence); actions=7; changed_lines=0; minutes=10

### Goal
Produce a PASS/FAIL verdict with screenshot evidence for every route below,
at every viewport, against the 8-question contract.

### Routes
| URL | Login as | Notes |
|-----|----------|-------|
| `/overview` | e2e.admin | Hub home (all roles) |
| `/my-day` | e2e.admin | Registry reqs [17]; if bounced record BLOCKED |
| `/admin` | e2e.admin | Admin hub |
| `/admin/config` | e2e.admin | Settings sections — check `.cx-settings-section` treatment (A4) |
| `/admin/roster` | e2e.admin | Roster table — check Q4/table scroll at 375 |
| `/people-holidays` | e2e.admin | |
| `/ecosystem` | e2e.admin | 3D/canvas scene (`EcosystemDynamic`) — audit chrome, overflow, fallback; canvas internals exempt from Q2 |

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
- Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/hub/<route>-<w>.png`
  (`fullPage: true`); every FAIL needs a shot at the failing width. These are
  test-output artifacts, not source files.

### Files
- Create: `specs/ux-ui-audit-v3/results/ux3-hub-1.md` | audit evidence table

### Evidence format (`results/ux3-hub-1.md`)
```
# UX3 audit — hub shard 1 — <date> — ux-ui-expert
Env: npm run dev @ :3000, e2e seed users, chromium
| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
## /<route> — PASS|FAIL|BLOCKED
- Q1..Q8: PASS/FAIL — one-line note each
- FAIL: what, where (selector/region), width, screenshot path,
  severity blocker|major|minor, suspected Phase-1 class (A1-A7/B1-B18) if any
```

### Context
- `e2e/users.ts:41-70` | `login()` helper + fixture identities
- `specs/ux-ui-audit-v3/PLAN.md:58-79` | Phase-2 contract wording
- `src/features/shared/components/shell/registry.ts:16-60` | hub route roles

### Contract
Read-only: no file under `src/`, `e2e/`, or `supabase/` may be modified.
Out of scope: fixing findings (→ fix shards), the `/` fallback route and
`/auth/*` (P2-APP-01), nav-rail/topbar chrome audit (P2-SH-01).

### Actions
1. Audit `/overview` at 4 widths.
2. Audit `/my-day` at 4 widths.
3. Audit `/admin` at 4 widths.
4. Audit `/admin/config` at 4 widths.
5. Audit `/admin/roster` at 4 widths.
6. Audit `/people-holidays` at 4 widths.
7. Audit `/ecosystem` at 4 widths.

### Done when
- `results/ux3-hub-1.md` has a complete row per route (all 8 Qs × 4 widths).
- Every FAIL cites width, selector/region, screenshot path, severity.
- Screenshot files referenced in the table exist on disk.

### Verify
- Run: `dir specs\ux-ui-audit-v3\results\ux3-hub-1.md specs\ux-ui-audit-v3\results\ux3-screens\hub` -> evidence file + screenshots present; 7 route rows.

### Handoff
FAIL lines → fix shards via `spec/P2-fix-template.md` (TL writes
`spec/fix-P2-<r>.md`). PASS rows count toward PLAN exit criterion 2.
