# DECISIONS: ui-label-size-sweep — PROPOSE findings, all approved by user (2026-11-20)

User approved all 27 PROPOSE findings in FINDINGS.md plus the ux-1 LOW
(`rows={2}` inert under `.pw-textarea` 72px floor). This file pins the
exact outcome for each — implement verbatim, no re-deciding.

## Labels (class L)
| file:line | current | new |
|---|---|---|
| disputes-page.tsx:43-46 Seg options | `Uphold: void the audit` / `Uphold: re-score` / `Reject` | `Uphold dispute: void the audit` / `Uphold dispute: re-score` / `Reject dispute` (escalate option untouched) |
| my-audits-page.tsx:~97 Deny button | `Deny` | `Deny: it did not happen` |
| mail-desk-page.tsx:~330,~338 | `Approved` / `Rejected` | `Approve` / `Reject` (labels only; `setPending` values + ConfirmInline copy unchanged) |
| my-day-page.tsx:~535 | `Done` (follow-up mail row) | `Mark done` |
| hub-shared.tsx:~587-592 `If` | `Now:/Next: <time>` quiet button, no action hint | keep visible text; add `aria-label={`Jump to up next (${item.live ? 'Now' : 'Next'}: ${item.at})`}` |

## Table-row / card CTA `size="sm"` (apply to ALL — one convention)
Add `size="sm"` to every `<Button>` inside these row/card action cells,
including primary/quiet/danger variants already present:
- `audit-queue-page.tsx:466-486` (Start audit + Skip)
- `audit-queue-detail.tsx:384-397` (Start + Waive), `694-705` (Start + Remove), `903-914` (Start + Remove), `1464-1477` (Remove/Grant audit access)
- `kb-gaps-page.tsx:200-205` (Mark added to KB)
- `qa-forms-page.tsx:444` (Edit)
- `calibration-page.tsx:345-352` (Audit)
- `qa-shared.tsx:894-900` (Answer this section / Skip section N/A)
- `agents-page.tsx:447-453` (Refresh now + Remove)
- `aging-page.tsx:28-47` HelpCell (Mark handled/Send/Cancel/Ask my TL for help)
- `scheduler-page.tsx:~506-521` (Agree/Decline/Approve/Reject — confirm exact lines)
- `my-actions-page.tsx:88-119` (Post update / blocked toggle / Done)
- `tph-grid-views.tsx:683` (Remove)
- `meetings-page.tsx:211-215` (Log N actions — resolves the sm+md mix)

## Pair fixes (tsx + scoped CSS)
- `ctls-page.tsx:261,276` — `rows={2}` on both; append
  `[data-app="quality"] #ctl-reason,[data-app="quality"] #ctl-notes{min-block-size:auto}`
  to `styles/quality.css` (relaxes the shared 7rem floor for these two only).
- `checkins-page.tsx:170` — `rows={2}`; append scoped
  `#<id>{min-block-size:auto}` for that textarea's actual id in
  `styles/queue.css` (relax `.chk-note` 6.2rem for it only; keep `.chk-note`
  rule for other users if any).
- `checkins-page.tsx:161-163` — agents-now number input: scoped
  `inline-size:auto;max-inline-size:100%` in queue.css.
- `ctls-page.tsx:192-202` — `#ctl-ref`: `[data-app="quality"] #ctl-ref{inline-size:auto;max-inline-size:100%}`.
- `audit-queue-detail.tsx:1426-1431` — `#qa-access-find`: `[data-app="quality"] #qa-access-find{max-inline-size:28rem}`.
- `hub-shared.tsx:766-790` + `trackers-page.tsx:516-529` `.other-row` —
  append ONE additive rule in `src/app/cx-kit.css` beside `.other-row`:
  `:root .other-row :is(.cx-btn,.btn){justify-self:start}` (input keeps full
  width, buttons hug content). Do not restructure the components.
- `people-holidays-page.tsx:213,225` — `hd-mobile`/`hd-hr` inputs: extend
  the C1 selector or add `[data-app="hub"] .dq-editor .cx-input[type="tel"],[data-app="hub"] .dq-editor .cx-input[inputmode]{inline-size:auto;max-inline-size:100%}` (match actual input types).

## ux-1 fold-in (rows inert under 72px floor)
Add `pw-textarea--short` class alongside the existing `rows={2}` on:
`tl-tasks-page.tsx:777`, `one-on-ones-views.tsx:1746`,
`one-on-ones-views.tsx:1761` (3.5rem floor, sibling convention —
`oo-views:1353` precedent). Leave `rows={3}`/`rows={4}` pw textareas
(72px ≈ intent) and all `.cx-textarea` sites as-is.

## Still out of scope
`passed`/`Passed` vocabulary, `PassForm` name, `.qa-whylist` foreign hunk,
shared `ui/` primitive internals, backend files, commits until PM stage.
