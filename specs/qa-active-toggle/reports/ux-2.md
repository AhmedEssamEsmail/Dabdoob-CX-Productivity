# ux report - qa-active-toggle - round 2 (FULL, S03 delta only)

Verdict: FAIL
Open: 0B/0H/1M/2L

Scope reviewed: the S03 UI delta on /audit-queue — `audit-queue-page.tsx` (`actMode` state, `qa-queue-active` Seg at :251-266, `P.queuePage(who, actMode)` at :141). Consistency spec: sibling `qa-active`/`qs-active` Segs (ux-1), the page's own `qa-queue-status` Seg + `.page-actions` convention, shared `Seg`/`cx-kit.css`. Server files (`server.ts`, `route.ts`, `P.queuePage` signature) verified for UX-facing semantics only; prior ux-1 PASS on S01/S02 stands — this round reviews only the delta.

States checked: loading (initial → `LinesSkeleton`; Seg mounts only once `s` truthy — same as sibling controls in the aside), refetch (SWR keeps prior `s` — no skeleton flash, no layout shift), empty (filtered-out set → existing `Empty` + zeroed `To do · 0` counts; `unmatched`/`mine`/`auditors` deliberately unfiltered per PLAN), error (`LoadError` retry), disabled (n/a — no disabled options), long text (`flex-wrap` + `max-inline-size:100%`), mobile (`.page-actions` `flex-wrap:wrap`; `page-head` wraps — 320px overflow unlikely, unverified live), dark (shared tokens, themed both schemes — same as ux-1 Segs), keyboard (native radios → arrow-key group nav, single tab stop), focus (`input:focus-visible + span` 2px `--cx-focus` outline — same shared style, ratios from ux-1).

Consistency/interaction ✓: labels `Active only`/`All users`, option order, `aria-label="Show agents"`, and Seg placement in the page's top controls all match siblings and PLAN. `name="qa-queue-active"` unique. Toggle refetches correctly: `setActMode`+`c()` batch → `usePageData` effect (`deps:[tick]`) re-runs the NEW loader once — no stale-mode fetch (qa-3 test confirms `'all'` passed). Refetch keeps `seg` status filter — correct.

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-6 | MED | `audit-queue-page.tsx:255-259` | `onChange` calls `p(null)` unconditionally → unmounts a mounted `AuditForm` even when the audited agent survives the filter. The form's own cancel path guards dirty state (`I()` dirty-check → `C2` confirm, qa-shared.tsx:776-786); the toggle bypasses it — typed question answers + comment silently discarded. Worse for keyboard: native radios commit on arrow-key, so one arrow press on the focused Seg = instant discard + refetch, no preview. | Drop `p(null)` and let the refetched `sRows`/`sRequests` `_`-lookup (lines 174-182) collapse the entry only when the row actually left the filtered set; surviving rows keep their open form. If the row can vanish while dirty, route the close through AuditForm's confirm (e.g. pass a `requestClose` that runs `I()`). | dev |
| ux-7 | L | `audit-queue-page.tsx:264` | `aria-label="Show agents"` under-describes — the filter also removes team-lead-keyed quota rows and auditor visibility (carried from ux-1 finding ux-2 on the sibling Segs). | Rename to "People to show" across all three Segs in one pass. | dev |
| ux-8 | L | `audit-queue-page.tsx:140` | `actMode` is component state reset by the `who`-keyed remount — switching "Audit Desk of" silently returns to `Active only`. Consistent with "active = default" and matches the analytics page's state-only convention (PLAN scoped hash persistence to scores), so log-only. | Optional: lift `actMode` to `AuditQueueRoute` so the choice survives view-as. | dev |

Not verified / assumptions:
- No live run: 320/375/1024px render, focus-not-obscured (2.4.11), and `e2e/page-contract` remain unverified (wrap styles make overflow unlikely; deferred with QA's e2e).
- Contrast/target-size inherited from shared `.cx-seg` — ux-1 measured values (≈6.1:1 labels, 4.1:1 focus, ≥34px targets) apply unchanged; no new ad-hoc styles introduced.
- ux-1 LOWs ux-3/ux-4/ux-5 (URL parity, `.cx-seg` hover, checked-pill contrast) remain open app-wide; unchanged by this delta.
- ux-6 assumes the current `_`-lookup collapse behaviour; if dev confirms entries must close even for surviving rows, severity drops to LOW.
