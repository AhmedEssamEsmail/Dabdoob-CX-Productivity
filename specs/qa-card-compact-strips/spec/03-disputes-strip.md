# S03: "to decide" disputes become collapsible strips
Kind: mini
ID: S03
Parent: none (root)
Owner: dev
Depends: S01
Criteria: PLAN #2 (collapsed one-line strip, expanding reveals case/AuditFails/escalation/DecisionForm-or-waiting), #4 (native `<details>`), #5 (`decideDispute` unchanged)
Skills: none
Budget: files=1; actions=5; changed_lines=110; minutes=10

## Goal
Rewrite the "to decide" dispute items (`disputes-page.tsx` L163-205) as native
`<details>` strips: one-line `<summary>` (chevron + score + agent + meta +
status pill); expanded `.qa-detail` shows the agent's case, `AuditFails`, the
escalation block, and `DecisionForm` or the waiting line — all unchanged.

## Files
- Edit: `src/features/cx-quality/components/disputes-page.tsx` | `i.map` block L162-205; container class at L162

## Context
- `mockups/disputes-compact/a.html:55-188` | exact approved markup — `<details class="… da-item">`, `<summary>` row, `.dsp-detail` body; rows: open L55-96/L98-133/L153-188, escalated-waiting L135-151
- `mockups/disputes-compact/mock.css:4-45` | mechanics `.qa-card--strip`/`.qa-chev`/`.qa-detail`/`.qa-cap` now implement
- `src/features/cx-quality/components/disputes-page.tsx:39-135` | `DecisionForm` — rendered unchanged inside `.qa-detail`
- `src/features/cx-quality/components/qa-shared.tsx:292-314` | `AuditFails` output shape (the `.qa-cap` caption is a sibling `<div>`, not inside it)

## Contract
Item: `<details className="qa-card qa-card--strip" key={l.disputeId}>` (no `card`, `card-pad`, `qa-card__head`). Children, in order:
1. `<summary>` containing ONLY:
   - the chevron, verbatim: `<svg className="qa-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>`
   - `<ScorePill score={l.oldScore} fatal={l.audit?.fatal} />` — unchanged
   - `<strong className="qa-name">{l.agentName}</strong>`
   - `<span className="qa-meta">`: `<span>ticket <TicketRef url={n.ticketUrl} id={l.audit.ticketId} />, audited by {l.auditorName} on {l.audit.auditDate}</span>` (only when `l.audit`) then `<span className="qa-sep">·</span>` then `<span>{l.status === 'escalated' ? `escalated by ${l.escalatedByName}, ${l.escalatedAt.slice(0, 10)}` : `raised by ${l.raisedByName}, ${l.raisedAt.slice(0, 10)}`}</span>`
   - `<StatusPill s={l.status} />` — unchanged
   - No interactive elements inside `<summary>` (native a11y rule).
2. `<div className="qa-detail">` containing the CURRENT detail content verbatim, same conditions: agent's-case `qa-reason` `<p>` (raised-by parenthetical stays), `<div className="qa-cap">Lost marks on</div>` inserted immediately before `{l.audit ? <AuditFails a={l.audit} /> : null}`, escalated `qa-reason` block, then `{l.status === 'escalated' && !n.isOwner ? <p className="cx-muted">Waiting for…</p> : <DecisionForm … />}` — with `<div className="qa-cap">Meeting outcome</div>` inserted immediately before `DecisionForm` only (not before the waiting line).
3. List container at L162: `className="grid"` → `className="qa-list"`.

Out of scope: `DecisionForm` internals, auditor/decided tables (L214-317),
`StatusPill`/`ScorePill`, `P.decideDispute`, no `open` prop/state on `<details>`
(native uncontrolled), no edits to other files.

## Actions
1. Swap the list container `grid` → `qa-list` (L162).
2. Replace `<article …>` + `<header className="qa-card__head">` (L164-175) with `<details>` + `<summary>` per Contract 1.
3. Wrap the existing detail body (L176-203) in `<div className="qa-detail">`; insert the `Lost marks on` `.qa-cap` before `AuditFails`.
4. Insert the `Meeting outcome` `.qa-cap` before `DecisionForm` (Contract 2 condition).
5. Close `</details>` where `</article>` was (L204); delete the old article/header tags.

## Done when
- Each "to decide" dispute renders as `<details>` collapsed by default; summary line = chev + score + name + meta + status pill
- Opening a row reveals agent's case, `AuditFails` under `Lost marks on`, escalation block when escalated, and `DecisionForm` under `Meeting outcome` (or the `Waiting for …` line)
- Escalated rows show `escalated by …` in summary meta; decide flow still calls `P.decideDispute` + `onDone=s`
- `tsc` + scoped eslint clean

## Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/cx-quality` -> exit 0

## Handoff
None (leaf). Visual parity with `mockups/disputes-compact/a.html` checked at PM
UX/UI gate. Write results/S03.md (<=10 lines); TL alone updates TRACKER.md.
