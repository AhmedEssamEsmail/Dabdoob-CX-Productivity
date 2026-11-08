# qa report - cleanup - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/2L

Checks run (all from `C:\Users\AHMED\KPIs\CX-Hub`, this session):
- `npx tsc --noEmit` → PASS, 0 errors
- `npx eslint .` → PASS, exit 0 (0 errors, 322 pre-existing warnings)
- `npx vitest run` → PASS, 46 files / 1140 tests (golden suite exercises repointed `scripts/parity/oracle.mjs`)
- `npx next build` → PASS, exit 0
- `ls -a C:\Users\AHMED\KPIs` → only `CX-Hub`, `_archive`, `.devin`; `nul` absent; `_archive/legacy-apps` holds all 8 legacy dirs; `_archive/devin-work` = 137 files
- `git status --short` / `git diff --stat` → 0 changes under `src/`; renames as `R`; only `migrate` path in `package.json`; no dependency/lockfile edits

## Criteria coverage (PLAN → evidence)
1. Workspace archive → verified by ls/find: 8 dirs under `_archive/legacy-apps/`, `devin-work` 137 files, `nul` gone. PASS
2. No loose docs/scripts at root → `ls` shows only config/build files (+ gitignored `cx-kpis-*.json`); both MDs `R`-renamed to `docs/history/`; canonical `scripts/ops/verify-db.js` kept (superset of deleted `verify-db.ts` — adds dotenv + sample output). PASS
3. Docs system → ARCHITECTURE/REPO-LAYOUT/TESTING/DEPLOYMENT present, substantive; spot-verified vs `vercel.json` (7 unique cron paths, tph-hourly :05/:55 hourly) and `supabase/migrations` (14 files). PASS
4. scripts/ reorg → only `ops/`, `parity/`, `legacy/`, `migration/` subdirs; `package.json` one-line path edit. PASS
5. migration/ tidy → `README.md` marks local-only; 5 `*.txt` under `logs/`; 0 at root. PASS
6. Gates green → all four run and pass (above). PASS
7. Zero `src/` changes → confirmed via git status (`src/app/legacy-apps.css` stale generator comment is allowed by spec/04). PASS
8. Moves preserve content → git `R` renames; golden diffs are oracle-path repoints only (filtered diff = empty). PASS

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | LOW | specs/cx-hub/PORTING-GUIDE.md:17,83,99 (+ extract-notes.md:3, specs/megaplan/audits/*.md, specs/tph-zero-backfill/04-legacy-migration.md:23) | Historical spec docs still cite moved paths (`scripts/oracle.mjs`, `scripts/legacy-extract.mjs`, `scripts/run-migration.ts`, `scripts/check-sheet-access.mts`) — commands as written now fail; grep evidence. | Repoint to `scripts/parity|legacy|migration|ops/…` or stamp docs as historical; specs are work artifacts so non-blocking. | tech-writer |
| qa-2 | LOW | eslint.config.mjs:18 | `verify-db.js` globalIgnore entry now matches nothing (file moved to `scripts/ops/`, covered by `scripts/**/*.js`). Dead config line. | Delete the `verify-db.js` entry on next config touch. | dev |

Not verified / assumptions:
- `_archive/devin-work` completeness: 137-file count matches TL report; source was moved, not diffed (no baseline remained).
- Moved scripts not executed directly; oracle proven via 1140-test golden run, `migrate` script path verified string-vs-file.
- `nul` may reappear if any Windows shell writes `2>nul` again — environment hazard, not a defect in this change.
- `scripts/ops/` holds 7 files vs shard's nominal 5 — cosmetic spec drift already noted by TL; no action.
