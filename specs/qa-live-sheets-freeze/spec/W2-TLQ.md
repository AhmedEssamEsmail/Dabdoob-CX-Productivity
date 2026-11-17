# W2-TLQ: tlqueue cuts — fc_messages + ol_sheet_id gone, Activities via mirror
Kind: package
ID: W2-TLQ
Dispatch: NEVER

## Goal and contract
`tlqueue.ts` performs ZERO sheet reads. `tlqReadTexting_` always takes the
Freshdesk path (fd_activities mirror rows + tickets first_responded_at) — the
`fc_messages` workbook read is deleted outright (accepted degradation per
DECISION: message-level pairs have no DB source yet). `tlqReadOlDb_` is
native-only: the `ol_sheet_id` sheet fallback is deleted and a non-native
`operational_loss` tracker throws honestly. The `io.book` seam, the `books` map
and the `fetchWorkbookTabs`/`sheetBook`/`SheetBookLike`/`prodReadCols_`
imports all go. Golden-pinned pure parsers (`tlqParseFcMessages_`,
`tlqMessagePairs_`, `tlqOlGridFromRecords_`, `tlqReadOlRows_`) STAY — the oracle
tests exercise them directly.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| W2-TLQ-01 | dev | none | #4 all three cuts + io seam removal | 2/7/260/10 |

## W2-TLQ-01: delete the three sheet paths + book seam + golden test updates
Kind: mini
ID: W2-TLQ-01
Parent: W2-TLQ
Owner: dev
Depends: none
Criteria: PLAN Amendment 4 #4 (fc_messages deleted, ol_sheet_id deleted, Activities via mirror/dbbook)
Skills: none
Budget: files=2; actions=7; changed_lines=260; minutes=10

### Goal
tlqueue.ts has no `book`/`fetchWorkbookTabs`/`sheetBook` left; texting reads
`io.fdActivityRows` directly; OL reads only the native tracker store; golden
tests drop the workbook fake and the freshchat-sheet parity case.

### Files
- Edit: `src/features/cx-queue/lib/tlqueue.ts` | `tlqReadTexting_` (:669-709), `tlqReadOlDb_` (:747-763), `TlqIo`/`tlqIo_` (:573-595, :601-644), imports (:42,53,60), docstring (:20-31)
- Edit: `tests/golden/queue-tlqueue.test.ts` | `bookFor` (:41-48), `fakeIo.book` (:58), `textingIo` (:414-415), the tlqReadTexting_ cases (:388-441), `sheetBook`/`SheetBookLike` imports

### Context
- `src/features/cx-queue/lib/tlqueue.ts:669-709` | `tlqReadTexting_` — the `:703` fdActivityRows fallback is already the exact target path (proves equivalence per DECISION)
- `src/features/cx-queue/lib/tlqueue.ts:747-763` | `tlqReadOlDb_` — native branch stays; only :758-762 (sheet fallback) goes
- `src/features/cx-queue/lib/tlqueue.ts:584-585,601-644` | `book` seam decl + `books` map + impl
- `tests/golden/queue-tlqueue.test.ts:388-441` | the three tlqReadTexting_ cases — `textingIo` injects `book`/`bookFor`; the oracle still has the legacy fc path
- `src/features/shared/migration/mappings/ops-tabs.ts` | untouched (ROW_TRANSFORMS stay)

### Contract
- `tlqReadTexting_`: delete the whole `fc_messages_ss_id` block (:672-693) and the `try { book('fd_activity_ss_id','Activities') } catch { fdActivityRows }` (:696-704); `rows` = `(await io.fdActivityRows(fromMs)).map((r) => (Array.isArray(r.cols) ? r.cols : []))` — the previous fallback verbatim. Notes: on success push `'Texting from the fd_activities mirror (Freshdesk path).'`; `tlqTextTouches_`/`tlqTextPairs_`/`ticketsSince` legs unchanged. `TLQ_SETTINGS` fc_messages_* defaults stay (harmless config keys; deleting them is out of scope).
- `tlqReadOlDb_`: keep the native branch; when the tracker row is absent or `storage_mode !== 'native'` throw `new Error('operational_loss tracker is not in native storage mode')` — no sheet fallback. Docstrings :20-31 updated to native-only + mirror-texting wording.
- Seam: delete `book` from `TlqIo` (:584-585), the `books` map (:601) and `book` impl (:629-644); drop `fetchWorkbookTabs`/`sheetBook` (:42), `prodReadCols_` (:53) and `SheetBookLike` (:60) imports.
- Tests: delete `bookFor` + `fakeIo`'s `book` line + `sheetBook`/`SheetBookLike` imports; `textingIo` drops the `book:` key; DELETE the 'freshchat sheet' case (:417-422 — oracle path no longer exists; `tlqMessagePairs_` keeps its own direct golden coverage at :149-165); keep 'freshdesk fallback' as the canonical case but with `fdActivityRows` returning the ACT rows (no book); rename the 'fd_activities mirror stands in' case to reflect that the mirror IS the path (assert same `r` as oracle's freshdesk leg; notes differ — assert `r` only).
Out of scope: `tlqParseFcMessages_`/`tlqMessagePairs_`/`tlqOlGridFromRecords_`/`tlqReadOlRows_` bodies, `fc_messages_*`/`ol_*` config defaults and REQUIRED_CONFIG lists, any other file.

### Actions
1. Rewrite `tlqReadTexting_` per contract (mirror-only texting leg).
2. Make `tlqReadOlDb_` throw on non-native tracker; delete the sheet fallback.
3. Remove `book` from `TlqIo` + `tlqIo_` impl + `books` map.
4. Drop the four now-dead imports and refresh the header docstring.
5. Golden test: remove `bookFor`/`book`/`sheetBook` seams, fix `textingIo`, delete the fc-sheet case, adapt the remaining two cases to the mirror-only path.
6. `npx tsc --noEmit` + `npx vitest run tests/golden/queue-tlqueue.test.ts`.
7. `rg "fetchWorkbookTabs|sheetBook|io\.book|fc_messages|ol_sheet_id|prodReadCols_" src/features/cx-queue/lib/tlqueue.ts` -> 0 hits (fc_messages only allowed in TLQ_SETTINGS/comment if kept).

### Done when
- tlqueue.ts is sheet-free; non-native OL throws; golden tests green without any book fake; tsc clean.

### Verify
- Run: `npx vitest run tests/golden/queue-tlqueue.test.ts && npx tsc --noEmit` -> pass / 0 errors.

### Handoff
`deferred:` gone from tlqueue.ts — feeds W2-STRICT-01. `io.fdActivityRows` remains the Activities source (identical cells to dbbook's fd_activities synth).
Write results/W2-TLQ-01.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
Leaf done + golden suite green; package verified when the tlqueue grep above is empty and `TlqIo` has no `book` member.
