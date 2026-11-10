# Dead-CSS sweep — S12 verification (post S12-01..07,09..12)

## Deleted families — re-verified 0 className users
`eslint local/loser-classnames-error` = **0 hits** across `src/**` (authoritative className-attr check):
`note*`, `agechip*`, `tabs*`, `brand-mark*`, `nav-link--off*`, `nav-ext*`, `cx-toast*`, `dq-needs|clear|spark|pct*`.
Sheets: `globals.css` + `legacy-apps.css` removed (S12-01); per-sheet dead rules removed in people/desk/operations/quality/queue/hub/productivity (S12-02/03/04/09/10/11); cx-kit/refresh loser rules + phantom tokens (S12-05); loser names purged from contract comments.

## Surviving loser families (warn-gated, migration backlog)
Token grep `src/**/*.tsx` (files containing family token):
- `empty*` — 37 files (hub/people/quality/desk/queue/productivity/operations + shared shell)
- `card*`/`card-pad`/`card-head`/`card-title`/`card-hint` — 41 files (all areas)
- `pill*` — 23 files; `tag*` — 5 files; `tbl*` — 3 files; `seg*` — 5 files
- `page-sub*` — 3 files; `pw-dialog*` — 1 file (cx-people/pw.tsx, live)
- `cx-tab`/`cx-tabs` — 1 file (shared/ui/Tabs.tsx); `cx-sr*`/`sr-only*` — 23 files (both live, single rule kept)
- `dq-*` live subset — 18 files (deleted dq-needs/clear/spark/pct subset = 0 users)

## Gates
- `npx tsc --noEmit` — clean.
- `npx eslint .` — 964 problems: **13 errors / 951 warnings**; 0 `loser-classnames-error`, 574 `loser-classnames-warn`, 1 `feature-boundary`, 7 `local-defs`. Errors are pre-existing/unrelated: tests `no-explicit-any`/`rules-of-hooks`, react-hooks ref/setState in cx-quality/cx-queue/shared components, `no-require-imports` in scripts/legacy, specs .cjs log file. Log: specs/ux-ui-audit-v2/logs/s12-08-lint.log.

## Follow-up
RESHARD_NEEDED: migrate surviving warn families to canonical `cx-*` vocab — `empty`, `card*`, `pill`, `tag`, `tbl`, `seg`, `page-sub`, `pw-dialog`, `cx-tab(s)` review vs Tabs.tsx contract, `dq-*` consolidation, plus 13 pre-existing eslint errors (react-hooks/tests) and cx-kit dead-not-in-SH-L2 rules (`.cx-filter-row`, `.cx-grid-3`, `.cx-sidelayout`, `.cx-dock`, `.cx-example`, `.cx-hc__*`, `.cx-assume__grid`, `.cx-typecards` — 0 users, still in sheet).
