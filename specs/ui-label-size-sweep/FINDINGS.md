# FINDINGS: ui-label-size-sweep (consolidated, 2026-11-20)

Sources: `inventory/cx-quality.md` (23), `inventory/desk-hub-ops.md` (8),
`inventory/people-prod-queue.md` (20). Total **51 findings**: **24 autofix**
(Phase 2 scope below), **27 propose** (listed for the user, NOT applied).
Coverage: all 44 component files across `src/features/**` per the three
checklists. No `passed`-vocabulary or shared-primitive changes.

## Phase-2 AUTO-FIX scope (24 findings)

### Shard group A — cx-quality compact controls (6 findings, 4 files)
| # | file:line | fix |
|---|---|---|
| A1 | `components/disputes-page.tsx:104` | `<Textarea>` add `rows={2}`; append `[data-app="quality"] .qa-card--strip .qa-detail textarea{max-inline-size:60ch}` to `styles/quality.css` |
| A2 | `components/kb-gaps-page.tsx:128` | `<Textarea id="kb-d">` add `rows={2}`; append `[data-app="quality"] #kb-d{max-inline-size:60ch}` |
| A3 | `components/my-audits-page.tsx:107` | `<Textarea>` add `rows={2}`; append `[data-app="quality"] .qa-ctlbox textarea{max-inline-size:60ch}` |
| A4 | `components/my-audits-page.tsx:86-100,112-122` | `.qa-actions` pair (`Confirm…`/`Deny`) + `Send denial`: `size="sm"` on all three |
| A5 | `components/audit-queue-detail.tsx:120-125,301-310` | PassForm + WaiveForm `.qa-actions` confirm/cancel pairs: `size="sm"` on all four |
| A6 | `components/qa-forms-page.tsx:336-349` | `.qa-form__foot` `Save as new version` + `Cancel`: `size="sm"` on both |

### Shard group B — people/productivity/queue textareas (12 findings, 8 files; rows only, no CSS)
| # | file:line | fix |
|---|---|---|
| B1 | `cx-people/my-actions-page.tsx:76` | `rows={3}` |
| B2 | `cx-people/coaching-page.tsx:86` | `rows={3}` |
| B3 | `cx-people/meetings-page.tsx:572,582` | `rows={4}` notes, `rows={3}` decisions |
| B4 | `cx-people/tl-tasks-page.tsx:217,222,777` | `rows={3}`, `rows={3}`, `rows={2}` |
| B5 | `cx-people/one-on-ones-views.tsx:1746,1761` | `rows={2}`, `rows={2}` |
| B6 | `cx-queue/checkins-page.tsx:180,184` | `rows={2}` both |
| B7 | `cx-productivity/status-validation-page.tsx:224` | `rows={2}` |

### Shard group C — short-content input width caps (4 findings; CSS-only scoped rules, `#qa-when` pattern)
| # | file:line | fix |
|---|---|---|
| C1 | `cx-hub/people-holidays-page.tsx:190-196` | `[data-app="hub"] .dq-editor .cx-input[type="date"]{inline-size:auto;max-inline-size:100%}` — home: `styles/refresh.css` (holds `.dq-editor`) or `hub.css` |
| C2 | `cx-hub/admin-config-page.tsx:227,237,247` | `#prod-assumptions-mq,#prod-assumptions-text,#prod-assumptions-wa{inline-size:auto;max-inline-size:100%}` — home: `styles/hub.css` |
| C3 | `cx-hub/my-day-page.tsx:609,613,617` | `.md-settings-form .input{inline-size:auto;max-inline-size:100%}` — home: `styles/hub.css` |
| C4 | `cx-operations/trackers-page.tsx:603-608` | `[data-app="operations"] .trk-form .input[type="date"],.trk-form .trk-num{inline-size:auto;max-inline-size:100%}` — home: `styles/operations.css` |

## Foreign-work rules for Phase 2 (binding)
- `git diff HEAD -- <file>` before every edit.
- `styles/quality.css` has a foreign `.qa-whylist li` hunk (~line 206) and our
  prior `#qa-comment` append: new rules must be appended in a disjoint
  location (end of the qa-form section or EOF). Never modify the foreign hunk.
- `styles/hub.css` is foreign-dirty: C2/C3 may append a disjoint new rule at
  EOF; if the diff overlaps `.md-settings-form`/admin-config selectors,
  record `deferred-foreign` in the result instead.
- Component files are all clean today; recheck before editing.

## PROPOSE findings (27 — reported to user, NOT applied)

**Label renames (class L, 5):**
- `disputes-page.tsx:43-47` — `Uphold`/`Reject` omit the object → `Uphold the dispute: …`
- `my-audits-page.tsx:93-100` — `Deny` → `Deny: it did not happen`
- `mail-desk-page.tsx:328-345` — `Approved`/`Rejected` → `Approve`/`Reject`
- `my-day-page.tsx:535-537` — `Done` on follow-up mail → `Mark done`/`Handled`
- `hub-shared.tsx:587-592` — `Now:/Next:` jump button → `Jump to up next` (or aria-label)

**Table-row/card CTA sm convention (15, one design decision — apply everywhere or nowhere):**
- `audit-queue-page.tsx:466-486`, `audit-queue-detail.tsx:384-397,694-705,903-914,1464-1477`, `kb-gaps-page.tsx:200-205`, `qa-forms-page.tsx:444`, `calibration-page.tsx:345-352`, `qa-shared.tsx:894-900`, `agents-page.tsx:447-453`, `aging-page.tsx:28-47`, `scheduler-page.tsx:506-521`, `my-actions-page.tsx:88-119`, `tph-grid-views.tsx:683`, `meetings-page.tsx:211-215` (mixed sm+md bar)

**Pair-fix / layout decisions (7):**
- `ctls-page.tsx:261,276` — rows + relax shared `min-block-size:7rem` rule
- `checkins-page.tsx:170` — rows + relax `.chk-note` `6.2rem` rule
- `checkins-page.tsx:161-163` — `Agents on it now` number input full-width
- `ctls-page.tsx:192-202` — `#ctl-ref` input full-width (`#qa-when` pattern)
- `audit-queue-detail.tsx:1426-1431` — `#qa-access-find` search full-width
- `hub-shared.tsx:766-790` + `trackers-page.tsx:516-529` — `.other-row` stretched buttons (shared cx-kit rule; layout decision)
- `people-holidays-page.tsx:213,225` — `hd-mobile`/`hd-hr` borderline short inputs
