# Spec index: dabdoob-refresh
Kind: index
Size gate: PASS

Two-part change per PLAN.md: rebrand every user-facing "CX Helm"/"CX
Productivity" string to "Dabdoob CX", and reskin/restructure the UI to the
`mockups/` design language (light + dark). Gates are run by the PM.

| ID | Kind | Spec/index path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01/00-index.md | - | none | #1 | not dispatchable |
| S02 | package | S02/00-index.md | - | S01-01 | #3 #4 | not dispatchable |
| S03 | package | S03/00-index.md | - | S01-01, S02-02, S02-04 | #1 #2 #3 | not dispatchable |
| S04 | package | S04/00-index.md | - | S02-04, S02-06 | #5 | not dispatchable |
| S05 | package | S05/00-index.md | - | S02-04 | #5 | not dispatchable |
| S01-05 | mini | S01/05-golden-oracle-brand.md | test-engineer | none | #1 | 2/4/40/10 |
| S06-01 | mini | S06/01-e2e-harness.md | test-engineer | S02-05, S03-02, S03-03, S03-04, S04-11, S04-12, S04-18, S04-19 | #6 | 5/4/80/10 |
| S04-20 | mini | S04/20-audit-form-card.md | dev | none | #5 | 1/6/380/10 |
| S04-21 | mini | S04/21-audit-queue-detail-mount.md | dev | S04-20 | #5 | 1/4/90/6 |
| S04-22 | mini | S04/22-agents-table.md | dev | none | #5 | 1/6/170/8 |
| S04-23 | mini | S04/23-myday-side-remainder.md | dev | none | #5 | 1/6/300/10 |

Rounds 1-2 done per reports/tl-1.md + tl-2.md: all leaves complete except
the three RESHARD_NEEDED items. S04-10 superseded -> S04-20 (qa-shared
AuditForm card anatomy) + S04-21 (`.md` right mount, dep S04-20). S04-14
superseded -> S04-22 (`.spark` dropped — no per-agent series in the
scorecard payload and no data-layer changes allowed; real `.delta`
vs-team chip instead). S04-04 remainder -> S04-23 (5 legacy side cards
reskinned `.card`/`.workitem`, functionality kept — UX gate reviews the
7-card side column vs mock's 2). Ready now: S04-20, S04-22, S04-23
(independent files; max 3 workers). Forbidden everywhere:
package.json/lockfile, `.env*`, `cx-kpis-*.json`, new npm deps,
`globals.css`/`legacy-apps.css` (generated, do-not-edit), `mockups/`
(read-only reference). Keep e2e hooks: `#nav`, `.nav-link`, `.rail-*`,
`aria-current`, `.state-screen`, `.cxp`, `.pv-*`,
`.cx-chip[data-status]`, `.cx-table`, `.tph-grid`, `role="alert"`. Every
leaf keeps `D()` i18n and role gating (`pageAllowed`, `inApp`,
`groupEntryLink`); run `git diff HEAD` for foreign in-flight edits first.
Size gate evidence: manual review vs LIMITS.md — every leaf <=10 files /
10 actions / 2000 lines / 10 min / 5 done-checks; PM runs `check_shards.py`.
