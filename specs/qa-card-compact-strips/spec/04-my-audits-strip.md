# S04: my-audits `AuditCard` becomes a collapsible strip
Kind: mini
ID: S04
Parent: none (root)
Owner: dev
Depends: S01
Criteria: PLAN #3 (collapsed strip; expansion reveals AuditFails + CTL box + CTL status lines), #4 (native `<details>`), #5 (`confirmCtl` confirm/deny unchanged)
Skills: none
Budget: files=1; actions=5; changed_lines=110; minutes=10

## Goal
Rewrite `AuditCard` (`my-audits-page.tsx` L26-125) as a native `<details>`
strip: one-line `<summary>` (chevron + `ScoreChip` + ticket + meta +
`StatusChip`); expanded `.qa-detail` shows `AuditFails`, the CTL confirm/deny
box with the denial textarea, and the CTL status lines — all logic unchanged.

## Files
- Edit: `src/features/cx-quality/components/my-audits-page.tsx` | `AuditCard` return markup L40-123; both `.qa-cards` containers L147, L166

## Context
- `mockups/disputes-compact/a.html:55-110` | same collapsible-strip pattern (no my-audits mockup exists; PLAN #3 defines the summary contents)
- `mockups/disputes-compact/mock.css:4-45` | mechanics `.qa-card--strip`/`.qa-chev`/`.qa-detail`/`.qa-cap` now implement
- `src/features/cx-quality/components/my-audits-page.tsx:26-39` | existing state (`deny`, `i`, `l`, `m`) and `u()`/`P.confirmCtl` — unchanged
- `src/features/cx-quality/components/qa-shared.tsx:242-254` | `ScoreChip` renders `.cx-chip` (already `flex:none` in strips per S01)

## Contract
Item: `<details className="qa-card qa-card--strip">` replacing `<article className="card card-pad qa-card">` (no `card`, `card-pad`, `qa-card__head`). Children, in order:
1. `<summary>` containing ONLY:
   - the chevron, verbatim: `<svg className="qa-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>`
   - `<ScoreChip score={a.status === 'rescored' ? a.finalScore : a.score} fatal={a.fatal} />` — unchanged expression
   - `<strong className="qa-name">{qaIsNum(a.ticketId) ? `Ticket #${a.ticketId}` : a.ticketId}</strong>` — unchanged expression
   - `<span className="qa-meta"><span>{a.channel}, audited {a.auditDate} by {a.auditorName}</span></span>`
   - `<StatusChip s={a.status} />` — unchanged
   - No interactive elements inside `<summary>`.
2. `<div className="qa-detail">` containing the CURRENT body verbatim, same conditions: `<div className="qa-cap">Lost marks on</div>` inserted immediately before `<AuditFails a={a} />`, then the `d.status === 'submitted'` `.qa-ctlbox` (confirm/deny buttons + conditional denial `cx-field` + `Send denial`), the `open` and other-status `cx-faint` `<p>` lines, and the `m` error `<p>` — all moved unchanged.
3. Both list containers: `className="qa-cards"` → `className="qa-list"` (L147, L166).

Out of scope: `deny`/`i`/`l`/`m` state, `u()` helper, `P.confirmCtl` calls,
`QaSection`/`.qa-avg`/`Count` block, `qa-shared.tsx` exports, other files. No
`open` prop/state on `<details>`; no new handlers.

## Actions
1. Replace `<article>` + `<header className="qa-card__head">` (L41-52) with `<details>` + `<summary>` per Contract 1.
2. Insert `<div className="qa-detail">` after `</summary>` and the `Lost marks on` `.qa-cap` before `<AuditFails>` (L53).
3. Move the CTL-box/`cx-faint`/error `<p>` blocks (L54-122) unchanged into `.qa-detail`; close `</details>` where `</article>` was (L123).
4. Swap `.qa-cards` → `.qa-list` at L147.
5. Swap `.qa-cards` → `.qa-list` at L166.

## Done when
- Each audit card renders as `<details>` collapsed by default; summary = chev + score chip + ticket + channel/date/auditor meta + status chip
- Expanding reveals `Lost marks on` + `AuditFails` + the unchanged CTL box / CTL status lines; Confirm, Deny and Send-denial still call `P.confirmCtl` then `onDone`
- Deny toggle (`aria-expanded`, `<5` char disable) behavior identical
- `tsc` + scoped eslint clean

## Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/cx-quality` -> exit 0

## Handoff
None (leaf). PM UX/UI gate checks strip parity with the disputes mockup
pattern. Write results/S04.md (<=10 lines); TL alone updates TRACKER.md.
