# S04-20: AuditForm — mock-06 detail-card anatomy (shared component)
Kind: mini
ID: S04-20
Parent: S04
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=6; changed_lines=380; minutes=10

## Goal
`AuditForm` in `qa-shared.tsx` renders the mock-06 detail anatomy — `.card`
with `.card-head` (title + hint + status `.pill` + back), `.card-pad`
(facts, interaction field, scoring `.tbl` rows with `.seg` answers, live
score + `.pill.bad` "opens CTL", `.note`, submit row). Pure markup/class
restructure; all scoring/validation/submit logic untouched. Shared with
calibration-page.tsx — that consumer needs no edit and must keep working.

## Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | `AuditForm` JSX return only (~L805-1005)

## Context
- `mockups/pages/06-audit-desk.html:97-130` | detail card anatomy
- `src/features/cx-quality/components/qa-shared.tsx:720-1006` | AuditForm — props, state `u/o/b/f/y/T`, `C = qaScoreAnswers(t, u)`, `J = qaBand(...)`
- `src/app/styles/quality.css:9-31` | `.qa-*` hooks (`.qa-q[data-answer=fail]` colors the checked seg) — keep these class names
- `src/features/cx-quality/components/calibration-page.tsx:289` | second consumer, same props — do not edit
- `src/features/shared/components/ui/Seg.tsx:23` | renders `.cx-seg` radiogroup — use as-is, do not reskin

## Contract
- `<form className="card qa-form">` (drop `cx-panel cx-panel--pad`; keep
  `aria-label={`Audit: ${t.title}`}`).
- `.card-head`: `.card-title` = `t.title`; `.card-hint` = "Under 100%
  opens a CTL for the team lead."; right side = back `Button variant="quiet"`
  ("← {c}", same `I` handler/disabled) + `.pill warn` "In progress".
- `.card-pad` order: `facts` (`{n}`, unchanged dl) → `qa-when` `.cx-field`
  (unchanged) → placeholder/repeat `cx-note`s (unchanged) → per-section
  `fieldset.qa-sec` (keep `legend`, `data-skipped`, `qa-sec__opt` skip
  control) whose questions become `<table className="tbl">` with thead
  `Question | Weight (.num) | Answer (.num)` and one
  `<tr className="qa-q" data-answer={Je ?? ''} data-fatal>` per question:
  `<td>` `.qa-q__text` = `.lead` question text + `qa-q__hint` + `qa-q__memo`
  (drop `qa-q__w`); `<td className="num">{ua}</td>`;
  `<td className="num">` = existing `<Seg>` + the `l && Je==='fail'`
  `qa-q__why` reason block (keep `qa-why-${F.id}` ids + `aria-required`).
- Comment `.cx-field` unchanged; error keeps `<p className="cx-error"
  role="alert">`. Footer `.between`: left = `.qa-score` block (keep
  `data-status={J}`, `aria-live="polite"`, `cx-num` + `qa-score__sub`)
  plus `.pill bad` `opens CTL` when `C.score !== null && C.score < 100`;
  right = `.qa-form__foot` submit + Cancel buttons (all disable logic,
  labels, handlers unchanged). After it, `.note` with the mock's inline
  info svg: "Submitting emails the result to the agent. Under 100% opens
  a CTL for the team lead."
- Out of scope: `Seg` internals, `quality.css`/`refresh.css`/any CSS file,
  calibration-page.tsx, audit-queue-page.tsx (mount move = S04-21),
  `qaScoreAnswers`/`ds`/`qaBand`, `QA_ANSWER`/`QA_WHY`, all state/handlers.

## Actions
1. Wrap `<form>` in `.card` anatomy: `.card-head` (title/hint/pill + back button) + `.card-pad`; keep `qa-form` class.
2. Move facts, `qa-when` field and the two `cx-note` blocks into `.card-pad` unchanged.
3. Convert each `qa-sec`'s `.qa-q` divs into a `.tbl` (thead + `tr.qa-q` rows per the Contract cells, keeping `data-answer`/`data-fatal`, `Seg`, `qa-q__why`).
4. Rebuild the footer: `.between` with `.qa-score` + conditional `.pill bad` `opens CTL` on the left and `qa-form__foot` buttons on the right, then the `.note` line.
5. Keep comment field and `role="alert"` error where they are inside `.card-pad`.
6. `npx eslint src/features/cx-quality/components/qa-shared.tsx` + `npx tsc --noEmit` clean.

## Done when
- Audit form shows `.card`/`.card-head`/`.card-pad`/`.tbl`/score-footer anatomy per mock 06:97-130.
- Answering, section skip, fail-reason, validation gating, submit and cancel behave exactly as before in BOTH audit-queue and calibration.
- `role="alert"`, `aria-live`, `qa-*`/`cx-seg` classes preserved.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-quality/components/qa-shared.tsx` -> 0 errors

## Handoff
S04-21 mounts this card as the `.md` right column of audit-queue-page.
Write results/S04-20.md (<=10 lines); TL alone updates TRACKER.md.
