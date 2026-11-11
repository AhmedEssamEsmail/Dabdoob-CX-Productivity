# ord-02 — trackerRegistry_ canonical order for setupTrackers
Status: done — operations.test.ts fully green (188/188); tsc --noEmit clean.
Files: src/features/cx-operations/lib/trackers.ts (+18/-4) — new readTrackersRegistry_() helper; trackerRegistry_ now reads `trackers` unordered.
Chosen key: none exists — trackers has no monotonic/seq column and all fixture rows share submitted_at, so no `.order()` can reproduce legacy sheet/insertion order. Fix = unordered `db().from('trackers').select('*')`, identical to the pre-pushdown readStore semantics (physical row order); the registry is tiny so max-rows truncation is a non-issue. tracker_fields read unchanged (fields sort by position anyway).
Verify: `npx vitest run tests/golden/operations.test.ts` → 188 passed, incl. :1085 view-as ordering pin.
Handoff: none — ord-01/ord-03 remain for full golden green.
