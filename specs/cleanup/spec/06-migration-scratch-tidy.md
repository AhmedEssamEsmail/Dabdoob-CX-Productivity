# 06-migration-scratch-tidy   (shard id: S06)
Owner: dev     Depends: none     Criteria: PLAN #5
Skills: none     (owner invokes these first, nothing else)

## Goal
Mark `migration/` as local-only scratch tooling and move its `*.txt` logs under `migration/logs/`. Dir is gitignored (`/migration/` in `.gitignore`) — plain file moves, no `git mv`. Run from `C:\Users\AHMED\KPIs\CX-Hub`.

## Files
Create ONLY: `migration\README.md`, `migration\logs\` + moved txts
Read-only context: `.gitignore:44`, `package.json` lines 19–21 (migrate:local/validate/dry-run)
Forbidden: everything else — no `.ts` edits, no git ops (nothing here is tracked)

## Steps
1. Baseline: `(Get-ChildItem -Recurse -File migration).Count` → record N (expect 22: 17 `.ts` + 5 `.txt`).
2. Write `migration\README.md`: heading + notes — this dir is **local-only, gitignored** (`/migration/` in `.gitignore`); one-off data-migration tsx scripts (`migrate-all`, `migrate`, `migrate-dry-run`, `validate`, `pre-run-counts`, `probe-*`, `dbg*`, `spot-tickets`, `dryrun-map`, `check-trackers`, `verify-f21`); invoked via `npm run migrate:local` / `migrate:validate` / `migrate:dry-run`; requires `.env.local` creds; `logs/` holds run logs; nothing here may be committed.
3. `New-Item -ItemType Directory -Force migration\logs`; `Move-Item migration\*.txt migration\logs\` (counts-post, counts-pre, run-log-tickets-retry, run-log, validate-md).

## Done when
- `Get-ChildItem -Name -File migration` = only `.ts` files + `README.md`; `Get-ChildItem -Name migration\logs` = the 5 `.txt` files
- `(Get-ChildItem -Recurse -File migration).Count` = N (nothing lost)
- Verify: `npx tsc --noEmit` -> 0 errors (`migration` is tsconfig-excluded; sanity check only)
