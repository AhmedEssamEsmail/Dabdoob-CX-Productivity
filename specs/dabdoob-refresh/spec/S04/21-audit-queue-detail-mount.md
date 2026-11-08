# S04-21: audit-queue — mount the open audit inside `.md` right column
Kind: mini
ID: S04-21
Parent: S04
Owner: dev
Depends: S04-20
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=90; minutes=6

## Goal
`audit-queue-page.tsx` matches mock 06 layout: the open audit (AuditForm,
already a `.card` after S04-20) renders as the RIGHT column of the `.md`
grid next to the "Today's queue" `.card`; a placeholder `.empty` card
holds the right column when nothing is open.

## Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | open-audit mount block (~L1682-1782) + `.md` wrapper (~L1806-1874)

## Context
- `mockups/pages/06-audit-desk.html:84-131` | `.md` = queue worklist left + detail card right
- `src/features/cx-quality/components/audit-queue-page.tsx:1568` | `document.getElementById('qa-audit-open')?.scrollIntoView` — keep the id working
- `src/features/cx-quality/components/audit-queue-page.tsx:1682-1806` | `{_ && k ? <div id="qa-audit-open"><AuditForm…/></div> : _ ? <p cx-note role="alert" id="qa-audit-open">…</p> : null}` then `<div className="md">`
- `src/app/refresh.css:437-444` | `.md` grid `minmax(20rem,26rem) 1fr`

## Contract
- Move the whole `{_ && k ? … : _ ? … : null}` block INSIDE
  `<div className="md">`, immediately after the queue `section.card`
  closes (before `</div>` that ends `.md` at ~L1874).
- Keep `<div id="qa-audit-open">` wrapping `<AuditForm>` and keep
  `id="qa-audit-open"` + `role="alert"` on the no-active-form `cx-note`.
- When `!_`, render as second `.md` child:
  `<section className="card"><div className="empty"><div className="s">Pick a queue item to start auditing.</div></div></section>`.
- `RequestedAudits`, `NonTicketAudits`, `OffQueueAudits`, the `QaSection`
  `qq-h` done-table, `qa-unmatched` note and the dismiss note stay OUTSIDE
  `.md`, unchanged. `.cxp.dq-page` root unchanged.
- Out of scope: `qa-shared.tsx` (S04-20), queue list card internals
  (S04-09 done), any handler/`P.submitAudit` wiring, CSS files.

## Actions
1. Cut the open-audit conditional block (form wrapper + no-form note) from above `.md` and paste it as the second child of `.md`, after the queue `section.card`.
2. Add the `!_` placeholder `.card`+`.empty` as the second `.md` child.
3. Confirm `#qa-audit-open` and `role="alert"` survive the move; adjust indentation only.
4. `npx eslint src/features/cx-quality/components/audit-queue-page.tsx` + `npx tsc --noEmit` clean.

## Done when
- Starting/continuing an audit renders the AuditForm card in the `.md` right column (and start-click scroll still lands on `#qa-audit-open`).
- No open item → right column shows the placeholder `.empty` card; `!k` keeps the `role="alert"` note.
- Everything below `.md` unchanged; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — audit-queue page done (supersedes S04-10 together with S04-20).
Write results/S04-21.md (<=10 lines); TL alone updates TRACKER.md.
