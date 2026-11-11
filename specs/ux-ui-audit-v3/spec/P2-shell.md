# P2-SH — shared/shell surfaces + unbuilt-page placeholder (package)

Kind: package. Dispatch: NEVER. Covers the app chrome every route shares
(`src/features/shared/components/shell/*`) and the `UnbuiltPage` placeholder
(`shell/StateScreen.tsx`) served by `src/app/[...slug]/page.tsx`.

## Children

| id | owner | scope | depends | criteria | budget |
|----|-------|-------|---------|----------|--------|
| P2-SH-01 | ux-ui-expert | 6 shell surfaces + `/fcr` | none | PLAN Phase 2 | files=1+evidence; actions=7; changed_lines=0; minutes=10 |

## P2-SH-01: Audit shell chrome + UnbuiltPage placeholder at 375/768/1024/1440

Kind: mini (audit — read-only; no source edits)
ID: P2-SH-01
Parent: P2-SH
Owner: ux-ui-expert
Depends: none
Criteria: PLAN Phase 2 (8-question page contract)
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md; C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md
Budget: files=1 (+screenshot evidence); actions=7; changed_lines=0; minutes=10

### Goal
One audit of the shared chrome (it wraps every route, so a shell FAIL is a
global FAIL) plus the full 8-question audit of the `UnbuiltPage` placeholder
component once, on `/fcr`.

### Scope
| Surface | Host | Notes |
|---------|------|-------|
| Nav rail (`AppShell`/`SiteChrome`) | `/overview` | collapse/expand, `aria-current`, group tones; 375px behaviour per `e2e/nav-collapse.spec.ts` |
| Topbar | `/overview` | title/user region stability (Q1) |
| Command palette (`CommandPalette`) | `/overview` | open via its trigger; overlay positioning at all widths |
| ViewAs menu (`ViewAs`) | `/overview` | admin-only role preview control |
| Toast region (`Toasts`) | `/overview` | visual check only if triggerable without code edits; else mark NOT-EXERCISED |
| Boot/error screens (`StateScreen`, `ErrorBoundary`, `BootSplash`) | observed during audits | note any raw-string state seen while auditing |
| `/fcr` | e2e.admin | **Unbuilt** registry route — run the FULL 8-question checklist on the placeholder at all 4 widths |

### Environment
1. Seed once (idempotent): `npm run test:e2e:seed` → fixture users
   `e2e.admin@` / `e2e.tl@` / `e2e.agent@dabdoob.com`, password
   `E2E-cx-local-2026!` (override `$E2E_USER_PASSWORD`). See `e2e/users.ts`.
2. `npm run dev` → `http://localhost:3000`. All pages gated by `src/proxy.ts`
   + roster role.
3. Sign in via `/auth/login` or `login(page, E2E_USERS.admin)` (e2e/users.ts).
4. Per viewport: `page.setViewportSize({ width, height: 900 })`,
   width ∈ {375, 768, 1024, 1440}.

### Checklist — answer per surface/route per viewport (PASS/FAIL)
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
- Shell surfaces: exercise each control once per viewport (collapse rail,
  open palette, open ViewAs). For Q4 confirm
  `document.documentElement.scrollWidth <= window.innerWidth`.
- A shell-level FAIL applies to ALL routes — record it once here, do not
  duplicate it into per-package results.
- Trigger states only via existing UI controls — never edit source.
- Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/shell/<surface>-<w>.png`
  (`fullPage: true`); every FAIL needs a shot at the failing width.

### Files
- Create: `specs/ux-ui-audit-v3/results/ux3-shell-1.md` | audit evidence table

### Evidence format (`results/ux3-shell-1.md`)
```
# UX3 audit — shell shard 1 — <date> — ux-ui-expert
Env: npm run dev @ :3000, e2e seed users, chromium
| Surface/Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
## <surface|/fcr> — PASS|FAIL|NOT-EXERCISED
- Q1..Q8: PASS/FAIL — one-line note each
- FAIL: what, where (selector/region), width, screenshot path,
  severity blocker|major|minor, suspected Phase-1 class (A1-A7/B1-B18) if any
- Shell FAILs flagged "GLOBAL — affects all routes"
```

### Context
- `e2e/users.ts:41-70` | `login()` helper + fixture identities
- `e2e/nav-collapse.spec.ts` | nav-rail collapse expectations at mobile width
- `src/features/shared/components/shell/` | AppShell, Topbar, CommandPalette,
  ViewAs, Toasts, StateScreen (source of the surfaces under audit)
- `src/app/[...slug]/page.tsx` | catch-all → `UnbuiltPage` for `/fcr`
- `specs/ux-ui-audit-v3/PLAN.md:58-79` | Phase-2 contract wording

### Contract
Read-only: no file under `src/`, `e2e/`, or `supabase/` may be modified.
Out of scope: per-route audits (other P2 leaves); fixing findings.
Unbuilt routes `/hard-cases`, `/kpi-close`, `/escalation-matrix` get only a
renders-check in their package shards — this leaf owns the placeholder's
full checklist via `/fcr`.

### Actions
1. Audit nav rail on `/overview` at 4 widths (collapse/expand + aria-current).
2. Audit topbar on `/overview` at 4 widths.
3. Audit command palette open state at 4 widths.
4. Audit ViewAs menu at 4 widths.
5. Audit toast region + any boot/error screens observed (mark NOT-EXERCISED
   if not triggerable).
6. Run the full 8-question checklist on `/fcr` at 4 widths.
7. Write `results/ux3-shell-1.md` with per-surface verdicts + screenshots.

### Done when
- `results/ux3-shell-1.md` has a complete row per surface + `/fcr`.
- Every FAIL cites width, selector/region, screenshot path, severity, and
  shell FAILs are flagged GLOBAL.
- Screenshot files referenced in the table exist on disk.

### Verify
- Run: `dir specs\ux-ui-audit-v3\results\ux3-shell-1.md specs\ux-ui-audit-v3\results\ux3-screens\shell` -> evidence file + screenshots present; 7 surface/route rows.

### Handoff
FAIL lines → fix shards via `spec/P2-fix-template.md`. Global shell FAILs get
priority — they fix every route at once. PASS rows count toward PLAN exit
criterion 2.
