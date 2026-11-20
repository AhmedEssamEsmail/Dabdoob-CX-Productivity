# ux report - qa-audit-footer-compact - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/3L

States checked: loading (Opening…/Saving…/Skipping…/Removing… labels), empty ("Nothing in your queue" colSpan row), error (`role="alert"` + `.cx-error`), success (toast via onDone), disabled (submit label shows cause: "N left"/"interaction time needed"; `.cx-btn:disabled` opacity .55, contrast-exempt), long text (60ch textarea cap, `qa-sub` wrap), keyboard (button/submit, focus restore to invoker), focus (universal `:focus-visible` cx-kit.css:120), dark (no new colors — token-only).

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | LOW | audit-queue-page.tsx:477-486 (Skip row button) | `aria-expanded` set but no `aria-controls`; expanded `<tr class="qa-passrow">` (L492) has no id/role. Pre-existing; only label changed this round. | Give the row cell an id (e.g. `qa-pass-panel-${w.queueId}`) and add `aria-controls` on the button. | dev |
| ux-2 | LOW | audit-queue-detail.tsx:77-84 vs :121 | CTA now reads Skip/"Confirm skip" but the done-toast still says "Passed #…" and history "Passed without an audit" — documented PLAN non-goal; logged so users reporting wording can be routed. | If copy coherence is later wanted, rename toast/panel strings in a separate spec. | dev/PM |
| ux-3 | LOW | audit-queue-detail.tsx:120-122 | Disabled "Confirm skip" gives no reason (unlike AuditForm's "(N left)" sibling at qa-shared.tsx:1065). Mitigated: select placeholder "Choose a reason, or write one" + `aria-required` on the note input. | Optional: append "(reason needed)" while `!r`. | dev |

## Verified against PLAN success criteria
1. Row button reads "Skip" (audit-queue-page.tsx:485); `aria-expanded` wiring, `passInvoker` focus restore, `P.passItem` flow unchanged. ✓
2. PassForm submit = "Confirm skip" / "Skipping…"; `x`-branch keeps "Remove"/"Removing…" (audit-queue-detail.tsx:121). ✓
3. `#qa-comment` `rows={2}` (qa-shared.tsx:1014) + `max-inline-size:60ch` (quality.css:26); `htmlFor` label intact; `resize:vertical` still supplied by `.cx-textarea` (cx-kit.css:297-298); `width:100%` keeps it within 375px. ✓
4. Footer buttons both `size="sm"` → `cx-btn--sm` (min-height 1.9rem ≈ 30.4px ≥ 24px, WCAG 2.5.8 AA; cx-kit.css:216). Same size class as ConfirmInline — consistent. ✓
5. No new colors/sizes outside tokens; dark mode unaffected (rule sets only `max-inline-size`). ✓

## Not verified / assumptions
- **375px live layout**: `.between` (refresh.css:73) has NO `flex-wrap`; score block + foot could stay side-by-side and overflow at 375px when `opens CTL` chip + long disabled label coexist. Risk *reduced* by sm buttons vs prior md; could not measure — e2e/login infra down per tl-2. If the page contract ever fails here, it predates this change.
- Ellipsis char `…` used in all busy labels ✓; no `transition: all`, no outline suppression, no icon-only buttons in the diff.
- quality.css:209 `.qa-whylist li` change is a foreign dirty edit routed to PM (qa-2, tl-2); visual effect only (left-align + min-height), no a11y impact.
- `#qa-comment` id is unique per render — AuditForm mounts once per page (coverage:185, calibration:293).
