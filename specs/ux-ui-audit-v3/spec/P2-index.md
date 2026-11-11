# P2 — Phase 2 page-by-page visual sweep (index)

Source: `../PLAN.md` Phase 2 (lines 58-79). Route inventory enumerated from
`src/app/**/page.tsx` (44 files) + registry paths served by the `[...slug]`
catch-all = **47 distinct auditable URLs** in **10 audit leaves** across
9 package files. Owner for every leaf: `ux-ui-expert`. Size gate: PASS
(largest leaf = 9 actions, 0 changed lines).

| File | Leaves | URLs (built + placeholder/redirect) | Depends |
|------|--------|--------------------------------------|---------|
| `P2-app.md` | P2-APP-01 | 4 (`/`, login, logout, tph-grid→) | none |
| `P2-hub.md` | P2-HUB-01 | 7 | none |
| `P2-quality.md` | P2-QA-01, P2-QA-02 | 10 (5+5) | none |
| `P2-productivity.md` | P2-PROD-01 | 4 | none |
| `P2-queue.md` | P2-QUEUE-01 | 6 | none |
| `P2-people.md` | P2-PEOPLE-01 | 9 (7 built + 2 placeholders) | none |
| `P2-operations.md` | P2-OPS-01 | 2 (1 built + 1 placeholder) | none |
| `P2-desk.md` | P2-DESK-01 | 4 | none |
| `P2-shell.md` | P2-SH-01 | shell surfaces + `/fcr` placeholder | none |

Scheduling: PLAN wants Phase 1 pattern fixes merged first (audits find what
patterns missed); leaves are read-only and independent of each other.

Shared protocol (env, auth, checklist, evidence) is embedded verbatim in each
leaf — owners read only their leaf section. FAIL findings become dev
mini-shards per `P2-fix-template.md`; TL files them in `spec/fix-P2-<r>.md`.

Evidence: `specs/ux-ui-audit-v3/results/ux3-<pkg>-<n>.md` +
`results/ux3-screens/<pkg>/<route>-<w>.png`.

Unbuilt registry routes (`UnbuiltPage` via `[...slug]`): `/hard-cases`,
`/kpi-close`, `/escalation-matrix` get a placeholder quick-check in their
package shard; the full 8-question placeholder audit runs once on `/fcr` in
P2-SH-01.
