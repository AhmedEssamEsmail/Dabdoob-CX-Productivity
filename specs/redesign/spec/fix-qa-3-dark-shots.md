# Fix: missing dark shots for auth-login / no-access (qa-3)

Slug: fix-qa-3-dark-shots. Project root: `C:\Users\AHMED\KPIs\CX-Hub`.
Owner: dev     Source: `specs/redesign/reports/qa-1.md` finding qa-3 (MED), PLAN criterion #4.
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Finding
45/47 shot pages have both light+dark variants; `auth-login` and `no-access` are captured light-only because anon/unknown-role contexts bypass the dark loop (`shoot-new.mjs:96,253-259`). `auth/login` is a real route — its dark render (prefers-color-scheme path) has no visual evidence for UX review.

## Goal
Extend the shot harness so `auth-login` AND `no-access` are also captured in a dark context, then re-shoot so `.devin/work/shots/redesign/` contains dark variants for both.

## Files (only these)
- `.devin/work/shoot-new.mjs`
- `.devin/work/shots/redesign/` (generated output — shots, `_index.json`, `contract-report.json`)

## Rules
- Harness-only change: add a dark-context pass for the anon/no-access captures (mirror how the existing dark loop sets `data-theme="dark"` / `prefers-color-scheme`), don't alter page routes, viewport sizes, or the contract probes.
- Keep existing shot naming convention (dark variants suffixed as the current dark shots are).
- Do NOT touch `src/`, specs, reports, or other harness files.

## Verify
1. Re-run `node .devin/work/shoot-new.mjs` (full or the minimal pass that writes the index/report) — exit 0.
2. Confirm dark variants for `auth-login` + `no-access` exist in `shots/redesign/` and appear in `_index.json` / `contract-report.json`; total count ≥103.
3. `npx eslint .devin/work/shoot-new.mjs` 0 errors if lintable; `npx tsc --noEmit` unaffected 0 errors.
4. Update your TRACKER row notes + mark the `fix-qa-3-dark-shots` Review-findings row done with evidence. Reply <=100 words.
