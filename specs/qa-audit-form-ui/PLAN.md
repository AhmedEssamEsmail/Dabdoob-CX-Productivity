# QA audit-form UI fixes

Bugfix (light path). Three user-reported visual defects in the Quality app,
all on the audit-queue / non-ticket-audit flow.

## Symptoms

1. **"New non-ticket audit" form** — field boxes render in mismatched
   shapes/sizes/widths (Type and Agent selects tiny; Reference and Note
   inputs ~3x wider; submit button stretched). Same `.qa-request` layout
   also backs the "Request audit" / off-queue form.
2. **Answer and "why it failed" controls** — rendered as `Seg` radio groups
   squeezed into a `width:1%` table cell, so options stack vertically and
   look broken. Must be dropdowns (`<select>`) for **all** questions in all
   audit forms.
3. **Interaction date/time input** (`#qa-when`) — spans full panel width;
   should size to its content.
4. **Score summary box** (`.qa-score`, the "0% — N of M answered" footer
   block) — oversized in all audit forms; the number uses
   `--cx-text-2xl` with panel-scale padding. Should render compact
   (smaller number, tighter padding, inline with the footer actions).

## Expected

1. `.qa-request` forms lay out in a consistent grid — uniform field sizing,
   tidy rows at 375px and 1024px, submit button natural width.
2. In `AuditForm` (shared by queue audits, non-ticket, off-queue, and
   calibration — `qa-shared.tsx`), each question's Answer is a `Select`
   with Pass / Fail (/ N-A) options; when answer is `fail` and
   `askReasons`, the "why it failed" control is also a `Select`
   (Agent/Process/Product/KB). Unanswered stays unanswered (empty option),
   so `missing`/`A` gating and submit behaviour are unchanged. Fatal
   questions keep Pass/Fail only (no N/A) — see `da` logic.
3. `#qa-when` input shrinks to fit (e.g. `inline-size:auto;
   max-inline-size:100%`), still labelled and required.
4. `.qa-score` reads as a compact summary (not a hero number): smaller
   `.qa-score__num`, tighter padding, aligned with the footer button row.
   Sticky positioning may stay or go — pick whichever looks cleanest.

## Repro hints

- `src/features/cx-quality/components/audit-queue-detail.tsx` —
  `NonTicketForm` (~L537-640) uses `className="qa-request ..."`;
  `RequestForm` (~L160-260) shares the class.
- `src/features/cx-quality/components/qa-shared.tsx` — `AuditForm`
  question row ~L884-956: `Seg` for answers and for `QA_WHY` reasons.
  `QA_ANSWER` map at ~L608, `QA_WHY` at ~L600.
- `src/app/styles/quality.css` — `.qa-request` rules L181-184;
  `.qa-q__why` L33; `.qa-form .cx-table` cell sizing L22-25; the seg-fail
  tint rule L30 (`[data-answer=fail] .cx-seg ...`) becomes dead once the
  answer is a select — restyle or drop; `.qa-score` / `.qa-score__num` /
  `.qa-score__sub` L16-18 for the score box shrink.
- `Input`/`Select` in `src/features/shared/components/ui/` both accept
  `className`.
- Screen shot reference: Answer column shows Pass/Fail/N-A stacked as
  plain text with "Fail" tinted red, then "Why it failed" +
  Agent/Process/Product/KB stacked below.

## Non-goals

- `Seg` usages that are not audit questions stay: CTL outcome picker and
  CTL multi-pick (`ctls-page.tsx`), queue tabs, analytics/scores filters.
- No change to scoring, `missing`/reason counting, submit payloads, or
  server code.
- No DB changes.

## Risk flags

- `ui` → UX/UI gate. QA always runs.

## Gates

- `npx tsc --noEmit` clean.
- `npx eslint` clean on changed files (0 warnings).
- `npx vitest run tests/quality` green.
- Manual/browser check at 375px and 1024px: no h-scroll; every new
  `<select>` has an accessible name (aria-label/aria-labelledby — see
  `e2e/page-contract.spec.ts` contract #4).

## Conventions

- Verbatim legacy port: keep minified-style local names and the
  `/* legacy symbol */` comment headers; mimic surrounding style.
- Controls come from `@/features/shared/components/ui` (Button, Input,
  Select, Seg); page CSS lives in `src/app/styles/quality.css` under
  `[data-app="quality"]`, shared kit in `src/app/cx-kit.css`. Use `--cx-*`
  tokens, no px literals except existing `px-exact` annotations.
- AGENTS.md: UI "done" = 8-question page contract at 375/1024.
