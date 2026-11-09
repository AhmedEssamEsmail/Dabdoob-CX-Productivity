# PLAN — Compact `qa-card` strips (user-approved mockup "Option A")

## Goal
Restyle the `qa-card` item box across the Quality app into the approved
"Option A" compact strip: a single-line row per item, all action buttons on the
same line; collapsible expansion where the item carries detail worth hiding.
Approved mockups (rendered with the app's real CSS):
`mockups/ctl-compact/a.html` (pure strip) and
`mockups/disputes-compact/a.html` (collapsible strip, real `<details>`).

## Success criteria
1. `ctls-page.tsx`: every CTL row is a one-line strip — score pill, agent name,
   truncating meta (ticket ref + channel + owner context), status/due/outcome
   pills, and the row's buttons (`Open in the form`, `Resend result email`) on
   the same line. `data-late` red stripe and `data-picked` accent outline are
   preserved. Closed CTLs show their note inside the truncating meta.
2. `disputes-page.tsx`: each "to decide" dispute is a collapsed one-line strip
   (chevron + score + agent + ticket/auditor/raised-by meta + status pill);
   expanding reveals agent's case, `AuditFails`, escalation block, and the
   `DecisionForm` (or the "waiting for owner" line). Decision form still works.
3. `my-audits-page.tsx`: each audit card is a collapsed one-line strip
   (chevron + score chip + ticket + channel/date/auditor meta + status chip);
   expanding reveals `AuditFails`, the CTL box (confirm/deny + denial textarea),
   and CTL status lines. Confirm/deny flows still work.
4. All collapse/expand is native `<details>/<summary>` — no new state, no JS
   libs. Pills, buttons, tables reuse existing classes; new CSS lives only in
   `src/app/styles/quality.css` under `[data-app="quality"]`, token-based so
   dark + light themes both work.
5. Zero behavior change: same callbacks (`submitCtl`, `resendAuditMail`,
   `decideDispute`, `confirmCtl`), same data, same permissions (admin-only
   resend stays admin-only).

## Non-goals
- Other card systems are out of scope: `cx-panel`/`pv-cards`
  (status-validation), `md-card` (mail-desk), `my-actions`, `my-status` —
  different components, not `qa-card`.
- No redesign of the submit form, decision form internals, SLA/auditor tables.
- No data/API changes, no new dependencies.

## Risk flags
- `ui` → UX/UI gate after build. No db/auth/data/external-api/deps flags.

## Gates (from .devin/workflow.md, run in repo root)
- `npx tsc --noEmit`
- `npx eslint src/features/cx-quality src/app/styles` (scoped; full `npx eslint .` if cheap)
- `npx vitest run` (log to file, bounded tail)

## Conventions (workflow.md + lessons)
- Verbatim-port files: keep legacy structure/naming style; edits stay minimal.
- No `package.json`/lockfile/env edits. No commits (user hasn't asked).
- Token-based CSS only (`--cx-*`); both `data-theme` variants must render.
- Next.js 16 differs from training data — these are client components in
  existing files; no new Next APIs needed.

## Key pointers
- `src/features/cx-quality/components/ctls-page.tsx` — `qa-card` articles at ~L376-440.
- `src/features/cx-quality/components/disputes-page.tsx` — `qa-card` at ~L163-204; `DecisionForm` L39-135.
- `src/features/cx-quality/components/my-audits-page.tsx` — `AuditCard` L26-125.
- `src/app/styles/quality.css` — `.qa-card`/`.qa-actions` rules ~L32-40.
- Mockup CSS to mirror: `mockups/ctl-compact/mock.css` (`.va-*` strip rules +
  `.dsp-detail`/`details` mechanics in `mockups/disputes-compact/mock.css`).
- Buttons: `Button` supports `size="sm"` → `cx-btn--small`.
