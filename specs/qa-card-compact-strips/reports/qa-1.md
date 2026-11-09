# qa report - qa-card-compact-strips - round 1 (FULL)

Verdict: PASS
Open: 0B / 0H / 0M / 3L

## Checks run
- `git diff --stat` → 4 expected files only (+ unrelated `specs/perf-remediation/TRACKER.md`, flagged by TL, not this shard).
- `npx tsc --noEmit` → exit 0, empty log (no diagnostics).
- `npx eslint src/features/cx-quality` → exit 0; 0 errors, 26 warnings — all pre-existing unused-var/unused-directive warnings in untouched code (nearest: `ctls-page.tsx:200` eslint-disable directive, outside diff hunks).
- `npx vitest run` → exit 0; 55 files / 1129 tests passed.
- PLAN gate `src/app/styles` arg exits 2 (CSS dir ignored by eslint config) — gate-command artifact, confirmed same as TL note; scoped component lint used instead.
- Mockup conformance (structural, static): `mockups/ctl-compact/a.html` + `mockups/disputes-compact/a.html` + their `mock.css` vs implementation — all strip mechanics ported faithfully (chevron rotate, ellipsis `.qa-meta>span`, `.qa-sep`, `.qa-acts` `margin-inline-start:auto`, `.qa-note-txt` closed-note, 64rem wrap, `.qa-detail`/`qa-cap`).

## Criteria coverage
1. `ctls-page.tsx:374-436` — CTL rows are pure `qa-card qa-card--strip` articles: ScorePill, `qa-name`, `qa-meta` (ticket+channel+owner context) or `qa-note-txt` for closed-with-note rows, StatusPill + due/outcome pills, `qa-acts` (`Open in the form`/`Resend result email`, `size="sm"` → `cx-btn--small` verified in `Button.tsx:25`). `data-late`/`data-picked` preserved; `.qa-card` class retained so existing `[data-late=true]`/`[data-picked=true]` rules (quality.css:33-34) still apply. Closed-CTL note-only strip matches mockup `a.html:141-150` (no ticket/owner on closed rows — by design).
2. `disputes-page.tsx:164-223` — native `<details>` strips; summary = chev + ScorePill + `qa-name` + `qa-meta` (ticket/auditor + raised/escalated-by) + StatusPill; `.qa-detail` reveals Agent's case, "Lost marks on" cap + AuditFails, "Not aligned" escalation block, "Meeting outcome" cap + DecisionForm or waiting-for-owner line. DecisionForm props unchanged.
3. `my-audits-page.tsx:41-140` — AuditCard as `<details>` strip; summary = chev + ScoreChip + ticket + meta + StatusChip; `.qa-detail` = "Lost marks on" cap + AuditFails + unchanged CTL box (confirm `confirmCtl(id,true,'')`, deny + textarea `confirmCtl(id,false,i)`, min-5-chars gate, error line).
4. All collapse via native `<details>/<summary>`; zero new state/JS libs. New CSS append-only in `src/app/styles/quality.css:213-239`, all `[data-app="quality"]`-scoped, `--cx-*` tokens only (all tokens defined in `theme.css` incl. light+dark `data-theme` variants).
5. Zero behavior change confirmed by diff: `submitCtl` form untouched (outside hunks), `ResendMail` logic + `n.isAdmin && r.audit` gating unchanged, `decideDispute`/`DecisionForm` props unchanged, `confirmCtl` calls unchanged.

## Findings
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | LOW | disputes-page.tsx:176 | `qa-sep` `·` rendered unconditionally inside `qa-meta`; if `l.audit` is null (`l.audit?.fatal` at L167 implies possible) the meta opens with an orphan separator. | Wrap sep in `{l.audit ? … : null}` like the ticket span above it. | dev |
| qa-2 | LOW | repo root | Stray build artifacts in working tree: `nul` (Windows misredirect), `eslint2.log`, `eslint2.exit`, `gates.log`, `npm-ci.log`; `results/S01.md`+`S03.md` landed at root `results/` not the spec dir (TL noted). Evidence: `git status --porcelain`. | Delete root logs/`nul`; move result files under `specs/qa-card-compact-strips/results/` before commit. | dev |
| qa-3 | LOW | quality.css:32 | `.qa-cards` selector now unreferenced anywhere in `src` (both lists switched to `qa-list`); dead selector half of the rule. | Drop `.qa-cards,` from the selector (harmless if left). | dev |

## Test quality
UI-only restyle, zero new behavior — no new tests required by PLAN; existing 1129-test suite green provides regression cover. No assert-nothing/snapshot-only additions.

## Regression & scope
Diff confined to the 4 shard files; no package.json/lockfile/env edits; no new deps; no console/TODO/debugger leftovers in diff. `qa-card__head`/`qa-actions`/`qa-ctlbox`/`qa-ctlform` still used elsewhere (ctls-page:68,272; my-audits:71,82; audit-queue-page) — retained CSS is still live.

## Not verified / assumptions
- Live browser render not run: no e2e gate in PLAN; app needs Supabase auth/seeded data (cannot provision). Verified structurally vs approved mockups + CSS instead; the `ui`-flag UX/UI gate is PM-run per workflow/TL report.
- Assumed `l.audit` may be null per existing defensive `?.` (qa-1 severity LOW accordingly).
