# S02: CTL rows become one-line strips
Kind: mini
ID: S02
Parent: none (root)
Owner: dev
Depends: S01
Criteria: PLAN #1 (CTL strip), #4 (classes/`<details>` rules — no `<details>` needed here), #5 (same callbacks/data/permissions)
Skills: none
Budget: files=1; actions=5; changed_lines=140; minutes=10

## Goal
Rewrite the `n.rows.map` CTL item (currently `ctls-page.tsx` L376–441) as the
approved pure single-line strip: score pill, agent name, one truncating meta
region, status/due/outcome pills, and the row's buttons on the same line.
`data-late`/`data-picked` stay; closed CTLs show their note inside the meta.

## Files
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | `ResendMail` (L294–322) + row markup (L375–441); container class at L375

## Context
- `mockups/ctl-compact/a.html:66-150` | exact approved strip markup (open rows L66-139, closed row L141-150) — mirror with real data
- `mockups/ctl-compact/mock.css:78-99` | `.va-item` geometry that `.qa-card--strip` now implements
- `src/features/shared/components/ui/Button.tsx:8-26` | `size="sm"` → `cx-btn--small` (mock buttons are all `cx-btn--small`)
- `src/features/cx-quality/components/qa-shared.tsx:266-274` | `TicketRef` renders `<a>` for numeric ids — keep inside meta span
- `src/features/cx-quality/components/ctls-page.tsx:326-334` | `m(r)` pick callback + `i` picked state — unchanged

## Contract
Item: `<article className="qa-card qa-card--strip" data-late={…} data-picked={…}>` — the article IS the flex row (no `card`, `card-pad`, `qa-card__head`, `qa-actions`, `qa-owner` classes on it). Child order:
1. `{r.audit ? <ScorePill score fatal/> : null}` — unchanged
2. `<strong className="qa-name">{r.agentName}</strong>`
3. Truncating region: `<span className="qa-meta">` for open rows and for closed rows without notes; `<span className="qa-note-txt">` for closed rows WITH `r.notes`. `.qa-meta` contents: `<span>ticket <TicketRef url={n.ticketUrl} id={r.audit.ticketId} />, {r.audit.channel}</span>` (only when `r.audit`) then `<span className="qa-sep">·</span>` then `<span>` with the owner text (`r.own ? 'Your agent' : `Owner ${r.tlName}; shown to you because you were on shift when it opened`` + the `closedBy` suffix — verbatim strings from current L412-419). `.qa-note-txt` contents: `{r.action}: {r.notes}{r.agentNote ? ` Agent: “${r.agentNote}”` : ''}` + `closedBy` suffix when present (verbatim from L429-433/416-418).
4. Pills — unchanged logic, in current order: `StatusPill`, open→due/overdue pill, closed→`slaMet` pill, `outcome` pill, `reopenCount` pill
5. `<span className="qa-acts">` — merges today's two `.qa-actions` blocks: `r.status === 'open'` → `<Button size="sm" variant="primary" onClick={() => m(r)}>Open in the form</Button>`; `n.isAdmin && r.audit` → `<ResendMail …/>`. Admin gating and `audit` guard unchanged.
6. `ResendMail`: add `size="sm"` to its `<Button>` (only use site).
7. List container at L375: `className="grid"` → `className="qa-list"`.

Out of scope: `CtlForm`, `CtlAuditSide` (its `qa-card__head` at L68 stays), SLA
table, `StatusPill`/`ScorePill`/`findOpenCtls`, any other page/file, callbacks
`P.submitCtl`/`P.resendAuditMail`, no new state/handlers.

## Actions
1. Swap the list container `grid` → `qa-list` (L375).
2. Replace the `<article>` open tag + `<header className="qa-card__head">` (L377-411) with the strip children per Contract 1-4.
3. Replace the `qa-owner` `<p>` (L412-419) and the closed-note `<p>` (L429-434) with the `.qa-meta` / `.qa-note-txt` region per Contract 3.
4. Merge the two `.qa-actions` blocks (L420-439) into one `.qa-acts` span per Contract 5.
5. Add `size="sm"` to the `ResendMail` `<Button>` (L318).

## Done when
- Every rendered CTL row is one `.qa-card--strip` article; open rows show meta (ticket+channel · owner), closed rows with notes show `.qa-note-txt`
- `data-late`/`data-picked` attributes still emitted; `m(r)` still fires on `Open in the form`; resend still admin-only + `r.audit`-guarded
- Both row buttons render `cx-btn--small`; no `qa-card__head`/`qa-actions`/`qa-owner`/`card-pad` class left in the row markup
- `tsc` + scoped eslint clean

## Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/features/cx-quality` -> exit 0

## Handoff
None (leaf). Visual parity with `mockups/ctl-compact/a.html` checked at PM
UX/UI gate. Write results/S02.md (<=10 lines); TL alone updates TRACKER.md.
