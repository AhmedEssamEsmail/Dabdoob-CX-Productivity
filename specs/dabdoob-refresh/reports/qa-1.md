# qa report - dabdoob-refresh - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/2L

Checks run:
- `npx tsc --noEmit` -> PASS (clean, exit 0)
- `npx eslint . --quiet` -> PASS (ESLINT_EXIT=0, 0 errors)
- `npx vitest run` -> PASS (54 files, 1117/1117 incl. 6 command-palette tests)
- `npm run test:e2e` -> PASS per S06-01/TRACKER evidence (75p/10s/0f x2); all e2e-covered files (login, my-status, status-validation, shell) predate the run — round-3 edits (qa-shared, audit-queue, agents, my-day) have no e2e specs
- Shot harness -> 103 shots, 0 readySel/pageerror; contract-report.json re-verified: targetOk 103/103, rowH=36/baseFont=13 on all 32 measured, btnMinH=target on all measured except ecosystem (see qa-2)
- Rebrand greps: `CX Helm` in src/ -> 2 hits, both code comments (registry.ts:15, notify.ts:32); `CX Productivity` -> 2 hits, both inside the allowed "Dabdoob CX Productivity" (registry.ts:506, admin-page.tsx:212); `Dabdoob CX` present in rail (AppShell.tsx:408), login (page.tsx:65), layout.tsx:9 title, BootSplash.tsx:61+ar inline, APPS titles, mail sender name (mail.ts:206), email footers (maildesk/notify/reminders/tasks/meetings/jobs/myday)
- Regression greps: 0 removed `D(` lines / 82 added; 0 removed `pageAllowed|inApp|groupEntryLink`; all e2e hooks present (`#nav`, `.nav-link`, `.rail-*`, `aria-current`, `state-screen`, `.cxp`, `.pv-*`, `[data-status]`, `.cx-table`, `.tph-grid`, `role="alert"`, `#qa-audit-open`); login posts to same `/api/auth/login`

Criteria coverage:
1. PASS — greps clean per PLAN (comment hits allowed); Arabic BootSplash variant updated.
2. PASS — login-card/brand-row/brand-mark/forgot-row/login-foot matches mock-01 anatomy; token-styled (light+dark auth-login shots exist).
3. PASS — `.nav ul{list-style:none}` (cx-kit.css); static "Dabdoob CX"+"Operations console" brand; `.rail-search` opens CommandPalette (⌘K/Ctrl+K, fuzzy subsequence filter of `PAGES` gated by `pageAllowed`, Arrow/Home/End/Enter/Esc nav); toasts `margin-inline-start: rail-w + gap` (RTL+mobile handled).
4. PASS — refresh.css: `.stat[data-tone]` strips, `.delta` up/down/flat, `.pill` tones, `.tbl` (td .8125rem=13px, ~33px rows), `.mixbar/.spark/.empty/.workitem/.md/.ag-item/.seg`; `--cx-target` 2.25rem fine / 2.75rem coarse untouched; contract report confirms.
5. PASS — all 10 mockup pages carry the anatomy classes (verified per-file); ~30 remaining pages normalized via S05 leaves; `page-purpose` = single head-sub line (matches mock head+sub), no prose walls.
6. PASS — all gates green (above); 47 pages x light+dark shots.

Scope: clean — 65 modified files all in PLAN scope; lib diffs are string-only brand swaps; `registry.ts` APPS titles only (groups/server/scopes intact); no package.json/lockfile/.env*/cx-kpis-*.json/globals.css/legacy-apps.css edits; mockups/ untouched (mtimes predate PLAN/shots); no new deps; no debug leftovers/TODOs in diff; golden-test D-BRAND seam rewrites only the exact `(via CX Helm)` suffix incl. base64 bodies — all other bytes still compared (sound, not weakening).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-1 | LOW | CommandPalette.tsx:114-123 | Convention deviation: uses `router.push`/`location.assign` directly instead of shell `navigate` (view transitions) + `pageHref` helper; functionally equivalent but skips the view-transition animation on palette nav. | Wrap `router.push` in `document.startViewTransition` guarded like AppShell `navigate`, or accept deviation. | dev |
| qa-2 | LOW | ecosystem-page (shot contract) | Contract report: first button btnMinH=0, radius 8.8px vs 10px target (light+dark). Page diff is a 1-line title change — pre-existing markup, not a regression; flagged for UX gate. | None required for this spec; note for UX/UI review. | ux-ui-expert |

Not verified / assumptions:
- Visual mock-parity judgment (layout/spacing vs mockups) delegated to the UX/UI gate — QA verified anatomy classes + clean shots only.
- my-day keeps 7 stacked side cards vs mock's 2 — deliberate per S04-23 (functionality preserved); UX gate owns the call.
- `.spark` column intentionally absent on agents (no per-agent series exists; `.delta` vs-team used instead) — documented S04-22.
- `next build` not run — PM gate; no build-only risks spotted (no new imports beyond refresh.css + CommandPalette).
- e2e pass evidence is from S06-01 (run twice, 75/10/0); QA did not re-run it — accepted because every e2e-covered file's last edit precedes the run.
