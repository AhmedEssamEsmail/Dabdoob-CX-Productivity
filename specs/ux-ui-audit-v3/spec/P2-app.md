# P2-APP — app-level routes (package)

Kind: package. Dispatch: NEVER. Covers `src/app/page.tsx`, `src/app/auth/*`,
`src/app/tph-grid/page.tsx` — routes owned by the app shell, not a feature dir.

## Children

| id | owner | routes | depends | criteria | budget |
|----|-------|--------|---------|----------|--------|
| P2-APP-01 | ux-ui-expert | 4 | none | PLAN Phase 2 | files=1+evidence; actions=4; changed_lines=0; minutes=10 |

## P2-APP-01: Audit app-level routes (4 URLs) at 375/768/1024/1440

Kind: mini (audit — read-only; no source edits)
ID: P2-APP-01
Parent: P2-APP
Owner: ux-ui-expert
Depends: none
Criteria: PLAN Phase 2 (8-question page contract)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md; C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1 (+screenshot evidence); actions=4; changed_lines=0; minutes=10

### Goal
Produce a PASS/FAIL verdict with screenshot evidence for every route below,
at every viewport, against the 8-question contract.

### Routes
| URL | Login as | Notes |
|-----|----------|-------|
| `/` | e2e.admin | Shell fallback dispatcher (`src/app/page.tsx`) — renders first allowed hub page; must not be blank or a raw redirect flash |
| `/auth/login` | logged out | Only unauthenticated page; run the full 8 questions here too |
| `/auth/logout` | e2e.admin | Redirects to `/api/auth/logout` → lands on login; verify clean transition, no broken-UI flash |
| `/tph-grid` | e2e.admin | Redirects to `/tph`; verify no interim broken render |

### Environment
1. Seed once (idempotent): `npm run test:e2e:seed` → creates
   `e2e.admin@dabdoob.com` / `e2e.tl@` / `e2e.agent@dabdoob.com`, password
   `E2E-cx-local-2026!` (override `$E2E_USER_PASSWORD`). See `e2e/users.ts`.
2. Start dev server: `npm run dev` → `http://localhost:3000`. Every page is
   gated by `src/proxy.ts` + roster role; unauthenticated → `/auth/login`.
3. Sign in via the `/auth/login` form, or drive Playwright with
   `login(page, E2E_USERS.admin)` from `e2e/users.ts`.
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
- If the fixture role is bounced to `/` or `/auth/login`, record **BLOCKED**
  (missing role), not FAIL.
- Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/app/<route>-<w>.png`
  (`fullPage: true`); every FAIL needs a shot at the failing width. These are
  test-output artifacts, not source files.

### Files
- Create: `specs/ux-ui-audit-v3/results/ux3-app-1.md` | audit evidence table

### Evidence format (`results/ux3-app-1.md`)
```
# UX3 audit — app shard 1 — <date> — ux-ui-expert
Env: npm run dev @ :3000, e2e seed users, chromium
| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
| /     | PASS| PASS| PASS | PASS | —          | PASS    |
## /<route> — PASS|FAIL|BLOCKED
- Q1..Q8: PASS/FAIL — one-line note each
- FAIL: what, where (selector/region), width, screenshot path,
  severity blocker|major|minor, suspected Phase-1 class (A1-A7/B1-B18) if any
```

### Context
- `e2e/users.ts:41-70` | `login()` helper + fixture identities
- `specs/ux-ui-audit-v3/PLAN.md:58-79` | Phase-2 contract wording
- `src/features/shared/components/shell/registry.ts` | roles per route

### Contract
Read-only: no file under `src/`, `e2e/`, or `supabase/` may be modified.
Out of scope: fixing findings (→ fix shards), auditing feature routes.

### Actions
1. Audit `/` per checklist at 4 widths.
2. Audit `/auth/login` logged out at 4 widths.
3. Audit `/auth/logout` transition at 4 widths.
4. Audit `/tph-grid` redirect behaviour at 4 widths.

### Done when
- `results/ux3-app-1.md` has a complete row per route (all 8 Qs × 4 widths).
- Every FAIL cites width, selector/region, screenshot path, severity.
- Screenshot files referenced in the table exist on disk.

### Verify
- Run: `dir specs\ux-ui-audit-v3\results\ux3-app-1.md specs\ux-ui-audit-v3\results\ux3-screens\app` -> evidence file + screenshots present; 4 route rows.

### Handoff
FAIL lines → fix shards via `spec/P2-fix-template.md` (TL writes
`spec/fix-P2-<r>.md`). PASS rows count toward PLAN exit criterion 2.
