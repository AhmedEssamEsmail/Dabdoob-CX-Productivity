# RMS-F01 — done
Files: tests/golden/hub-admin.test.ts (edited; +14 net lines)
Change: added `expectConfigSuperset` helper — iterates oracle `$.ok` map keys via diffPath, tolerates port-only keys (`reminders_enabled`); non-map/error envelopes fall back to exact `expectSame`. Applied to the 3 its: `getConfig matches`, `setConfig writes + returns the whole map`, `setConfig validation errors match` loop. Non-admin refusal assertions left exact.
Checks: `npx vitest run tests/golden/hub-admin.test.ts` -> 8/8 pass, run twice (green both).
Before: 3 its failed `oracle mismatch at $.ok: keys [...] != [...,reminders_enabled]`.
Blockers: none. No source/other test files touched.
