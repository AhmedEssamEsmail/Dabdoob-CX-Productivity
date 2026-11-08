# S04-10: audit-queue — audit detail card (.md right)
Kind: mini
ID: S04-10
Parent: S04
Owner: dev
Depends: S04-09
Criteria: PLAN #5
Skills: none
Status: superseded — split into S04-20 (qa-shared.tsx AuditForm anatomy) + S04-21 (page mount into `.md` right). No code was changed under this leaf (results/S04-10.md).
Budget: files=1; actions=5; changed_lines=280; minutes=10

## Goal
Right of `audit-queue-page.tsx`'s `.md` matches mock 06: `.card` audit
detail — header (ticket + agent + `.pill` status), scoring `.tbl` rows
with yes/no `.seg` controls, live score + CTL note, submit row.

## Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | detail region only

## Context
- `mockups/pages/06-audit-desk.html:97-130` | detail card anatomy
- `src/features/cx-quality/components/audit-queue-page.tsx` | existing audit form (scoring items, weights, submit)
- `mockups/assets/mock.css:219-227` | `.seg` per-row control look

## Contract
- Right `.card` in the `.md`: `.card-head` `.card-title` (ticket ref +
  agent) + `.card-hint` (started time · form · CTL rule) + `.pill`
  (`.warn` in progress / `.ok` done).
- `.card-pad`: scoring rows as `.tbl` — criterion (`.lead` + `.sub` note),
  weight `.num`, answer `.num` cell = `.seg` Yes/No (or the form's real
  options); wrong answer styling per mock (bad-soft when failed).
- Score footer: live `%` `.num` + `.pill.bad` `opens CTL` when under 100%
  (real logic already exists — keep), then `.note` explaining the email/
  CTL behavior, then the existing submit `.btn-primary` row.
- All functional behavior (scoring, validation, submit, CTL create)
  unchanged — markup/class restructure only.

## Actions
1. Wrap the detail in the right `.card` + `.card-head`.
2. Restyle scoring rows into `.tbl` with `.seg` answers.
3. Restyle score line + `.pill.bad` CTL marker + `.note`.
4. Keep every existing handler/validation.
5. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Detail card matches mock 06; scoring/submit work unchanged.
- CTL marker + note render when the score is under 100%.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — audit-queue done.
Write results/S04-10.md (<=10 lines); TL alone updates TRACKER.md.
