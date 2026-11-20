# ux report - ctls-page-cleanup - round 1 (FULL)

Verdict: FAIL
Open: 0/0/1/3

Scope reviewed (changed UI files from reports/tl-1.md, tl-2.md):
`src/features/cx-quality/components/ctls-page.tsx` (toolbar Seg, canClose gate),
`src/features/cx-quality/components/qa-shared.tsx` (`P.ctlPage(scope)`).
Cross-read for behaviour: `lib/server.ts` getQaCtlPage/submitQaCtl, `lib/core.ts`
qaCtlScopeVisible_/qaCanCloseCtl_, `ui/Seg.tsx`, `lib/use-page-data.ts`,
sibling `audit-queue-page.tsx` actMode Seg (the reference pattern).

States checked: loading (QaPage `busy` skeleton + Seg appears when data lands),
empty (`Empty` panel + SLA "No CTLs due this month yet"), error (QaPage error
slot; form inline `role="alert"`), disabled/busy (Submitting…, native radios),
long text (`title={r.agentName}`, qa-meta wrap — unchanged), mobile (2-option
Seg in toolbar slot — same slot/size as sibling actMode Seg), dark (no ad-hoc
colors; all shared tokens), keyboard/focus (native radio inputs in `role=
radiogroup` with `aria-label="Show CTLs"` — reachable, arrow-key navigable),
count consistency (server-side filtering; `p.length` derived from `n.rows`).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | components/ctls-page.tsx:29-41 (`findOpenCtls`) vs :448 (`r.canClose`) | The Mine/All plan goal (#5) gates only the "Open in the form" button. In 'all' scope the form's free-text ref lookup still matches any `status==='open'` row — `canClose` is never checked — so a TL can type another team's ticket, see the audit preview fill, write notes, then get rejected at submit by server.ts:1281 ("This CTL belongs to …; you can close it only while you are on shift."). Clear error text and input is kept, but it's the same dead-end submit the button gate removes — inconsistent gating between the two entry paths. | In `findOpenCtls`, add `&& c.canClose` to the filter (or keep the match but disable the submit button + show the same "belongs to" note when `y && !y.canClose`), so the ref path mirrors the button gate. | dev |
| ux-2 | LOW | components/ctls-page.tsx:462 | Empty-state copy "…an audit of your agent loses marks" is wrong in 'all' scope, where the list spans other teams' agents. | Scope-aware copy, e.g. `Empty` title = scope==='all' ? "No CTLs across teams." : existing text. | dev |
| ux-3 | LOW | components/ctls-page.tsx:416 | In 'all' scope the meta line "shown to you because you were on shift when it opened" is false — the row is shown because scope=all (already logged as qa-2, deferred LOW in tl-2). | Gate that clause on scope==='mine' (or on a `shiftVisible` flag) so 'all' rows just say "Owner X". | dev |
| ux-4 | LOW | components/ctls-page.tsx:349-352 | While the scope refetch is in flight the Seg shows the new selection but `n` still renders the old scope's rows — no busy affordance on the list. Identical to sibling actMode behaviour, so logged-only for consistency, not a regression. | Optional: dim/aria-busy the list while `loading`, or show a pending state — apply to both pages together if done. | dev |

Verified OK:
- Seg mirrors audit-queue actMode exactly: same toolbar slot, native radios,
  `aria-label` on `role="radiogroup"`, `setScope`+`reload()` in one batched
  handler; anonymous `useSe` loader refetches with the new scope (tick bump,
  latest closure — use-page-data.ts:60-79). Server echoes normalized `scope`.
- Seg hidden for admins (`n && !n.isAdmin`) per plan; 'mine' correctly drops
  the `shift_tls` leg via `qaCtlScopeVisible_`; inactive-agent open/on_hold
  rows filtered server-side with fail-open `actSet === null` — count chip
  "N open" can't diverge from the rendered list.
- `canClose = qaCanCloseCtl_(c, user, onShift)` hides the dead "Open in the
  form" button in All view; admin/on-shift still get it. No other dead
  controls; ResendMail unchanged (admin+audit only).
- No new colors, sizes, or components — no contrast/dark-mode deltas vs
  siblings. Copy tone ("My CTLs"/"All CTLs") matches sibling ("Active
  only"/"All users").

Not verified / assumptions:
- No Playwright run — layout judged from code; the diff reuses the sibling's
  exact toolbar pattern. 320/375px reflow, 2.4.7 focus-ring rendering, and
  measured contrast ratios (1.4.3/1.4.11) not re-verified; no new color or
  geometry was introduced.
- 2.5.8 target size: Seg visual targets are the shared `cx-seg` labels
  (padding-driven, same as sibling) — presumed ≥24px, not measured.
- Form-state persistence across scope switch (all→mine can orphan `picked`)
  leaves the typed notes intact and shows the "No open CTL … matches" hint —
  acceptable, matches sibling behaviour minus its dirty-form confirm.
