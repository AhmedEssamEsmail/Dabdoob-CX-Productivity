# FIX leaves: ux-ui-audit-v2 integration tsc blockers (round 4)

## tsc1-01: audit-queue-detail `ticketUrl` prop — required, not optional
Kind: mini
ID: tsc1-01
Parent: S13 (residual of S13-05 split)
Owner: dev
Depends: none
Status: ready
Criteria: integration gate `npx tsc --noEmit` clean
Skills: none
Budget: files=1; actions=2; changed_lines=4; minutes=3

### Goal
Two row components extracted by S13-05 declare `ticketUrl?: string` but pass it to `TicketRef({ url }: { url: string })` — TS2322 at :363 and :887. Pre-split code passed `d.ticketUrl` (any) unconditionally; restore compilability with zero runtime change by making the prop required.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | :336 + :861 — `ticketUrl?: string` → `ticketUrl: string` in both row-prop object types

### Context
- `src/features/cx-quality/components/audit-queue-detail.tsx:320-340,:849-865` | the two destructured prop signatures
- `src/features/cx-quality/components/qa-shared.tsx:244` | `TicketRef` requires `url: string` — do NOT loosen it (7+ strict consumers)
- Callers :515,:1033 pass `d.ticketUrl` where `d: any` — required prop compiles

### Contract
Prop becomes `ticketUrl: string` in both `RequestedAudits`/`OffQueueAudits` row components. Zero runtime/markup change — same value flows to `TicketRef`. If callers then error because the source type is genuinely optional, fall back to `url={ticketUrl ?? ''}` at the two JSX sites instead and note it — same leaf.
Out of scope: `TicketRef` signature, audit-queue-page.tsx, coverage file, any other tsc/site.

### Actions
1. Apply the prop-type edit at :336 and :861 (or the `?? ''` fallback if callers error).
2. `npx tsc --noEmit` + grep guard.

### Done when
- `npx tsc --noEmit` -> exit 0, zero errors.

### Verify
- Run: `npx tsc --noEmit` -> clean.

### Handoff
Unblocks tl4 integration gate. Write results/tsc1-01.md (<=10 lines); TL alone updates TRACKER.md.
