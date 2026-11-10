# capture-1 — Phase A CAPTURE result

Status: DONE. All 44 `src/app/**/page.tsx` routes screenshotted; 0 unreachable.

Files:
- `specs/ux-ui-audit-v2/capture-shots.mjs` — Playwright chromium harness; reuses e2e seeded users (`e2e/seed-users.mjs`, run OK) + real `/auth/login` form; role fallback admin→tl→agent on denial.
- `specs/ux-ui-audit-v2/shots/` — 128 full-page PNGs (1440x900 + 390x844 all routes; +768x1024 for 41 table/dashboard routes) + `INDEX.md` route→file map + `_index.json` machine-readable.
- `specs/ux-ui-audit-v2/shots/INDEX.md` — per-route shot list, statuses, notes.

Checks: `node e2e/seed-users.mjs` OK (3 users sign-in verified); capture log `/tmp/capture.log` — every route `OK`, only `/__catchall_probe__` initially SKIPped (dev server exited at end of batch run) then captured in a second pass: `[...slug]` catch-all redirects unknown paths to `/`; shots show the resolved home page. `/auth/logout` shots show the post-redirect `/auth/login` landing (redirect page, noted in INDEX).

Handoff: shots ready for Phase B area auditors. Dev server (`npm run dev`, bg shell) still running on :3000 for reuse; kill when done. No blockers.
