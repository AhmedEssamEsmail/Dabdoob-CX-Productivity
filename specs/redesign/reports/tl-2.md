# TL report — redesign — round 2 (FIX for reports/qa-1.md)

## Shards / findings
- **fix-qa-1-2-contrast** (dev) — done. qa-1 HIGH + qa-2 MED fixed in `src/app/theme.css` (`:root` only):
  `--line-strong` `#828a96` (3.49 vs surface / 3.25 vs paper; dark 4.57/5.04), `--cx-status-neutral-edge` `#6e7887` (3.70), `--cx-status-warn-edge` `#9a6b12` (4.15), `--cx-age-ink-3` `#0f1720` (4.60 vs `#d05f2a`; ink flip keeps ramp hue).
- **fix-qa-3-dark-shots** (dev) — done. `shoot-new.mjs` gained dark-context passes for `no-access` + `auth-login`; re-shot → **103 shots**, `auth-login-dark.png` + `no-access-dark.png` indexed in `_index.json`/`contract-report.json`.
- **Deferred (LOW):** qa-4 (eco3 canvas hex — needs waiver note), qa-5 (alpha-hex scrims), qa-6 (eco3-tag btnMinH=0 exemption — needs UX), qa-7 (stale comment; owner tech-writer not spawnable under this run's rules).

## Changed files (DELTA this round)
- `src/app/theme.css` — 4 token values, light only.
- `.devin/work/shoot-new.mjs` + `.devin/work/shots/redesign/` (gitignored harness output).
- `specs/redesign/spec/fix-qa-*.md`, TRACKER, this report.

## Gates (post-fix)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS 0 errors |
| `npx eslint .` | PASS 0 errors / 370 warnings (pre-existing baseline) |
| `npx vitest run` | PASS 46 files / 1140 tests |
| `node .devin/work/shoot-new.mjs` | PASS 103 shots, exit 0 |

## Scope check
`git status` — only `src/app/theme.css` modified by fixes; `.devin/work` gitignored; specs/reports as expected. No out-of-scope edits.

## Open issues
- e2e multi-browser re-run still recommended by QA (chromium was green; firefox/webkit unverified, prior failures were Supabase rate-limit).
- LOW findings qa-4..qa-7 deferred to PM/UX.
