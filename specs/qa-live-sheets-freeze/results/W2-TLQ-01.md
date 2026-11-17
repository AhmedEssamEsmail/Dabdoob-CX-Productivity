# W2-TLQ-01 — done
Status: done. tlqueue.ts is sheet-free: fc_messages leg, ol_sheet_id fallback and the `io.book`/`books`/`fetchWorkbookTabs`/`sheetBook`/`prodReadCols_`/`SheetBookLike` seam all removed; texting reads `io.fdActivityRows` (mirror note pushed); non-native OL tracker throws 'operational_loss tracker is not in native storage mode'; header docstring updated. Golden test dropped bookFor/fakeIo.book/sheetBook seams and the fc-sheet case; two mirror-path cases assert r vs oracle freshdesk leg.
Files: src/features/cx-queue/lib/tlqueue.ts, tests/golden/queue-tlqueue.test.ts
Checks: `npx vitest run tests/golden/queue-tlqueue.test.ts` 49/49 pass; `npx tsc --noEmit` 10 pre-existing errors, none in touched files; grep for dead symbols -> only TLQ_SETTINGS config keys remain.
Handoff: none. `deferred:` gone from tlqueue.ts — feeds W2-STRICT-01.
