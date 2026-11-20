# fix-qa-2 — regression assertions for S04–S06 pinned fixes

Source: `reports/qa-2.md` finding qa-2-1 (MED): PLAN criterion 5 requires
regression assertions where cheap; the 24 S04–S06 fixes (5 pinned labels +
aria-label, `size="sm"` convention, pair/textarea fixes) are unguarded.
Pattern to mirror: `tests/quality/qa-audit-footer-compact.test.tsx` (no-DOM
react stub + `react/jsx-runtime` descriptor mocks + `walk()` tree search;
data reached only via module seams, never real fetch).

## qa2-01: sweep regression spec — disputes/my-audits/mail-desk labels + sizes + hub-shared aria-label
Kind: mini
ID: qa2-01
Parent: fix-qa-2
Owner: test-engineer
Depends: none
Criteria: PLAN #5 (regression assertions); qa-2.md qa-2-1
Skills: none
Budget: files=1; actions=5; changed_lines=450; minutes=10

### Goal
One new vitest spec guarding the S04/S05 pinned label + size fixes in the
disputes, my-audits and mail-desk surfaces plus the hub-shared `If`
aria-label, so a revert of any pinned string or `size="sm"` fails the test.

### Files
- Create: `tests/quality/ui-label-sweep.test.tsx` | whole file

### Context
- `tests/quality/qa-audit-footer-compact.test.tsx:17-138` | copy the react
  stub, jsx-runtime mocks, `walk()` helper and the `qa-shared` seam
  (`useSe` returns a fixture; `P.*` are spies).
- `src/features/cx-quality/components/disputes-page.tsx:24-60,124` | internal
  `DecisionForm`; pinned Seg options at :43-45 (`'Uphold dispute: void the
  audit'`, `'Uphold dispute: re-score'`, `'Reject dispute'`; escalate pushed
  only when `canEscalate`); page loads via `useSe` from `./qa-shared`.
- `src/features/cx-quality/components/my-audits-page.tsx:84-102,152-153` |
  deny toggle `Button` children `'Deny: it did not happen'` with `size="sm"`;
  page loads via `useSe(P.myAuditsPage)`.
- `src/features/cx-desk/components/mail-desk-page.tsx:5,157-159,235,326-345,358` |
  internal `ApprovalCard`; actions `'Approve'`, `'Reject'`, `'Send reply
  only'`, each `size="sm"`; page data via `useLoaded` -> `usePageData` from
  `@/features/shared/lib/use-page-data` (mock that module).
- `src/features/cx-hub/components/hub-shared.tsx` `If` (~:583-592) | exported
  component; `Button` `aria-label` = `Jump to up next (${item.live ? 'Now' :
  'Next'}: ${item.at})`; visible text unchanged.

### Contract
Render page components through the precedent's stub harness with small
fixtures (shape read from each page's loader usage); internal components are
reached via the page render, not imported. Assert element props/children —
no DOM, no real fetch, no snapshots.
Out of scope: any src edit, other spec's assertions (Pass/Skip vocabulary,
`.qa-whylist`), e2e, exhaustive `size="sm"` coverage of all 12 S05 rows.

### Actions
1. Create the spec file; copy the stub/jsx mocks/`walk` from the precedent.
2. Mock `@/features/cx-quality/components/qa-shared` (`useSe` fixture seam +
   `P` spies) and `@/features/shared/lib/use-page-data`; render
   `DisputesPage` with a fixture that surfaces `DecisionForm` and assert the
   three pinned option labels.
3. Render `MyAuditsPage` with a fixture whose audit has a submitted CTL;
   assert the deny `Button` children `'Deny: it did not happen'` and
   `props.size === 'sm'`.
4. Render `MailDeskPage` with a fixture containing a waiting approval;
   assert `Approve`/`Reject`/`Send reply only` buttons exist, each
   `size === 'sm'`.
5. Render `If` with `live: true` and `live: false` items; assert
   `aria-label` matches the pinned template.

### Done when
- All five describe/assertion groups above pass.
- Each assertion fails if the pinned string/prop is reverted (spot-check one
  by temporary edit, then restore — or rely on descriptor equality).
- File is lint-clean per repo eslint (no new warnings on this file).

### Verify
- Run: `npx vitest run tests/quality/ui-label-sweep.test.tsx` -> exit 0

### Handoff
Spec file is self-contained; qa2-02 writes a different file — no shared
edit. Write results/qa2-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa2-02: sweep regression spec — my-day "Mark done" + pw-textarea--short
Kind: mini
ID: qa2-02
Parent: fix-qa-2
Owner: test-engineer
Depends: none
Criteria: PLAN #5 (regression assertions); qa-2.md qa-2-1
Skills: none
Budget: files=1; actions=3; changed_lines=300; minutes=10

### Goal
One new vitest spec guarding the S04 'Mark done' label on the my-day
follow-ups card and the S06/ux-1 `pw-textarea--short` + `rows={2}` fix on
the tl-tasks note textarea.

### Files
- Create: `tests/quality/ui-label-sweep-myday-tasks.test.tsx` | whole file

### Context
- `tests/quality/qa-audit-footer-compact.test.tsx:17-138` | copy the react
  stub, jsx-runtime mocks and `walk()` helper.
- `src/features/cx-hub/components/my-day-page.tsx:13-14,488,525-540,943` |
  internal `FollowUpsCard` renders a quiet `Button` children `'Mark done'`
  (:536) per waiting-mail item; `MyDayPage` seams:
  `@/features/shared/shell/context` (`getBoot`, `useBootSelector`) and
  `./hub-shared` (`useTh`, `Fs`) — mock modules, feed a fixture section.
- `src/features/cx-people/components/tl-tasks-page.tsx:6,591,770-780,891-892` |
  note `Textarea` at :778 with `className="pw-textarea pw-textarea--short"`
  and `rows={2}` inside the action update form (`note` state :591);
  `TlTasksPage` loads via `useSe('people.tasks', ...)` from `./shared`
  (`src/features/cx-people/components/shared.tsx:18-23`) — mock it.
- `specs/ui-label-size-sweep/DECISIONS.md` "ux-1 fold-in" | sibling precedent
  at `one-on-ones-views.tsx:1353`; only tl-tasks needs asserting here.

### Contract
Same harness rules as qa2-01: element-descriptor renders through module
seams only; assert props/children; no DOM/fetch/snapshots. Render
`MyDayPage`/`TlTasksPage` with the smallest fixtures that surface the two
controls (read loader shapes from the files).
Out of scope: any src edit; the other two `pw-textarea--short` textareas
(`one-on-ones-views.tsx:1746,1761`), CSS rules, other specs' assertions.

### Actions
1. Create the spec file; copy the stub/jsx mocks/`walk` from the precedent.
2. Mock the my-day seams; render `MyDayPage` with a fixture containing at
     least one waiting-follow-up mail item; assert a `Button` with children
     `'Mark done'` exists inside the follow-ups card.
3. Mock `./shared` `useSe` for tl-tasks; render `TlTasksPage` (or the
   smallest reachable subtree that mounts the note form) and assert a
   `Textarea` whose `className` contains `pw-textarea--short` and
   `rows === 2`.

### Done when
- Both assertion groups pass.
- Each fails if `'Mark done'` or `pw-textarea--short`/`rows={2}` is reverted.
- File is eslint-clean (no new warnings on this file).

### Verify
- Run: `npx vitest run tests/quality/ui-label-sweep-myday-tasks.test.tsx` -> exit 0

### Handoff
Different file from qa2-01 — runs in parallel. Write results/qa2-02.md
(<=10 lines); TL alone updates TRACKER.md.
