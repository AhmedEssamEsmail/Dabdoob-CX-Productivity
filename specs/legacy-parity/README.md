# Legacy Parity Programme (CX Helm GAS -> Next.js / Supabase)

Status: **Phases 1-2 complete (discovery + gap analysis). Phases 3-5 are planned, not started. No application code has been changed.**

Mandate (from the product owner): the legacy Google Apps Script (GAS) application is the product specification. The goal is a complete functional **and** visual replacement, not a selective port. Nothing outside Productivity is out of scope. Any visible difference is a defect.

This folder supersedes the scoping assumptions in `../migration-spec-v1/00-index.md`, `../migration-spec-v1/03-feature-inventory.md` and `../migration-spec-v1/MIGRATION_SPECIFICATION.md` (and the identical `original_deprecated/MIGRATION_SPECIFICATION.md`) sections 2.2-2.6. Those inventories were written from guesses (they list functions such as `getQAReviewPage` and a `Fcr.js` that do not exist anywhere in the legacy source). They must not be used as a checklist.

## Documents

| File | Phase | Content |
|---|---|---|
| `01-legacy-inventory.md` | 1 | Everything discovered in the legacy project: routes, rail, shell, workflows, jobs, integrations, roles, tables, settings, with evidence locations |
| `02-gap-analysis.md` | 2 | FEATURE / LEGACY EXISTS / NEW EXISTS / STATUS matrices, then per-module gap detail (sources, destination files, dependencies, APIs, UI components, scope) |
| `03-ui-ux-parity.md` | 3 | Visual-parity method, assets already extracted, known divergences, screenshot-diff acceptance harness |
| `04-functional-parity.md` | 4 | Business rules, jobs, permissions and integrations that must be reproduced, with the legacy source to port from |
| `05-implementation-plan.md` | 5 | Module order, per-module work packages, test gates, definition of done |
| `06-source-gaps-and-decisions.md` | all | **Blocking:** legacy source that is not in the repository, and decisions the owner must make before Phase 5 |
| `data/legacy-route-registry.json` | 1 | The legacy page registry extracted verbatim from the bundled app (40 pages, group order, labels, tones, per-app server file lists) |
| `data/legacy-i18n-ar.json` | 1 | The legacy Arabic string dictionary (80 entries) extracted verbatim |

## Headline findings

1. **The legacy product is 8 apps / 40 pages (+1 hidden route).** Hub (4), Quality (10), Productivity (4), Queue & Workforce (6), People & Performance (9), Operations & Trackers (2), TL desk (4), FCR (1). The new repository has working implementations of roughly 2.5 of those 40 pages (Status validation, TPH grid, partially My status) plus a thin Admin (Config, Roster).
2. **The repository does not contain the legacy source for most of the product.** `original_deprecated/` is the build of the *Productivity* app only (`AppBuild.js`: `CC_APP = "productivity"`). The bundled `index.html` contains page components for only 4 of 40 pages; the other 36 are registry entries (title, purpose, roles). 24 server files named in the bundle's app manifest are absent, as are the TSX sources, `scripts/apps.mjs`, `specs/ecosystem.md`, and the numbered requirements brief. See `06`. **Visual and functional parity cannot be achieved for those 36 pages from what is in the repo.** The owner needs to supply the full source tree (or live access) before Phase 5 can begin for them.
3. **FCR is unbuilt in the legacy system too.** Its manifest entry has `server: []`, `Health.js` marks it "Not built yet: sources pending", and it is the only system outside `HB_BUILT`. Parity for FCR therefore needs an explicit decision (see `06`, D3).
4. **Existing "done" claims in the new repo overstate coverage.** `src/lib/tph.test.ts` and `src/lib/productivity.test.ts` import nothing from the application: they assert on inline literals. The TPH cap engine (about 1,500 lines in `ProdTph.js`) has no implementation in the new repo. No `vercel.json` exists, so the three cron routes are never scheduled. `/api/quality/audits` and `/api/fcr/daily` are raw table pass-throughs with no business rules.
5. **Legacy UI and server are skewed in places.** The bundled UI still contains dispute flows (`raiseProdDispute` / `decideProdDispute`), but the server deliberately removed them (`ProductivityApp.js:754` "dispute mechanism disabled", `prod_disputes` removed, `prod_dispute_days` DEPRECATED, `getProdReviewPage` returns `disputes: []`). The dispute UI is dead code in legacy. See `06`, D5.

## Evidence conventions

- `[V]` verified directly in a legacy file or the new repo (path and line given).
- `[B]` read from the bundled app in `original_deprecated/index.html`. The extracted, un-minified working copies live in `.devin/work/extract/` (`app.js`, `app.css`, `registry.txt`).
- `[H]` hypothesis: inferred, not confirmed, and called out for verification.
- Sizing is relative (S / M / L / XL), never a time estimate.

## What happens next

Nothing is implemented until the owner answers the questions in `06`. Phase 3 tooling (the legacy screenshot harness in `.devin/work/`) already exists for the four Productivity pages and can be extended immediately. Phase 5 should start with the shared shell and Hub rail parity (module 1), which is possible with the evidence in hand, in parallel with the owner supplying the missing source.
