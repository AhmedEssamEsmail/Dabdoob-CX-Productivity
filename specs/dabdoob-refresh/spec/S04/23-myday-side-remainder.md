# S04-23: my-day — reskin the 5 remaining legacy side cards to `.card`/`.workitem`
Kind: mini
ID: S04-23
Parent: S04
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=6; changed_lines=300; minutes=10

## Goal
Remainder of S04-04: the five legacy `.md-card`s still below the new
Waiting/Focus cards — `DeadlinesCard`, `FollowUpsCard`, `MailCard` (+`Zl`,
`Tg`, `Gr`), `FilesCard`, `SettingsCard` — get the mock-03 card treatment:
`.card` + `.card-head` (title + count `.pill` on the collapsible ones) +
`.card-pad` with `.worklist`/`.workitem` rows and `.empty` states. Every
feature stays (mail search, mark-done, toggles/`localStorage`, settings
save + digest install); removing them would be a functional regression —
out of scope.

## Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | `ih` ~L361-377, `Gr` ~L138-150, `Zl` ~L273-298, `MailCard` ~L339-359, `FilesCard` ~L402-435, `DeadlinesCard` ~L437-460, `FollowUpsCard` ~L462-516, `SettingsCard` ~L518-587

## Context
- `mockups/pages/03-my-day.html:80-105` | `.card`/`.card-head`/`.worklist`/`.workitem`(`.wi-t`/`.wi-s`/`.wi-side`)/`.pill` anatomy
- `src/features/cx-hub/components/my-day-page.tsx:673-870` | `WaitingCard`/`FocusBlocksCard` from S04-04 — the pattern to mirror; do not touch
- `src/features/cx-hub/components/my-day-page.tsx:379-400` | `useNh` open-state hook — keep keys `md_open_*`
- `src/app/refresh.css:155-165,232-258,401-434` | `.card`, `.pill`, `.worklist`/`.workitem`

## Contract
- `ih` toggle → `.card-head` containing the same `md-cardtoggle` button
  (`aria-expanded`/`aria-controls`/onClick unchanged) rendering
  `.card-title` label + `.pill` count (still only when collapsed && >0).
- `DeadlinesCard`, `FollowUpsCard`, `FilesCard`: `section.md-card` →
  `section.card` (keep `aria-labelledby`); body div → `.card-pad` (keep
  `{id}-body` id); each `.md-list`/row → `.worklist`/`.workitem`:
  deadline `.wi-t` title, `.wi-s` due+owner, `.wi-side` `.pill bad`
  "Overdue" only when overdue; followup `.wi-t` subject link, `.wi-s`
  `{from}, {hoursWaiting} h without a reply`, `.wi-side` `{h} h` `.t` +
  the Done action as a small `.btn` (same `l(u)` optimistic handler);
  file `.wi-t` name link, `.wi-s` time. `Gr` `md-empty` →
  `.empty` `.s` (same text); `md-err`/`md-skel` kept; followup error
  keeps `role="alert"`.
- `MailCard`: `section.md-card` → `section.card`; static head →
  `.card-head` (`.card-title` "Waiting for your reply", `.card-hint` =
  the existing `md-sub` sentence); `.card-pad` keeps `Tg` search
  (Input+Button, `role="search"`); `Zl` groups keep `details`/
  `md-mailgroup`/summary + count, but their `.md-list` items become
  `.workitem` (`.wi-t` subject link, `.wi-s` `{from}, {h} h…` suffixes).
- `SettingsCard`: `details.md-card.md-settings` → `details.card`;
  `summary.md-h2` → `summary` rendering `.card-head` (`.card-title`
  "Settings and morning email"); form + texts → `.card-pad`, all
  fields/labels/`Fs.setSettings`/`installDigest`/`role="status"`/
  `field-error` unchanged.
- Keep: every `Fs.*` call, `useNh`, `aria-expanded`/`aria-controls`,
  `role="alert"`/`role="status"`, section order in `md-side`, `D()`
  where already present. Out of scope: `WaitingCard`, `FocusBlocksCard`,
  `TimelineCard`, `DaySection`, `md-layout`/`md-main`, `styles/hub.css`,
  deleting or merging any card.

## Actions
1. `ih` → `.card-head` toggle (`.card-title` + collapsed count `.pill`); `Gr` `md-empty` → `.empty .s`.
2. `DeadlinesCard` + `FilesCard` → `.card`/`.card-pad` + `.workitem` rows.
3. `FollowUpsCard` → `.card`/`.card-pad` + `.workitem` rows with `.wi-side` Done `.btn` (keep mark-done machine + `role="alert"`).
4. `MailCard` + `Zl` → `.card`/`.card-head`/`.card-pad`, `.workitem` rows inside kept `md-mailgroup` details (keep `Tg` search).
5. `SettingsCard` → `details.card` + `.card-head` summary + `.card-pad` form.
6. `npx eslint src/features/cx-hub/components/my-day-page.tsx` + `npx tsc --noEmit` clean.

## Done when
- `.md-side` shows Waiting + Focus (untouched) then the five reskinned `.card`s — no `.md-card` shells remain.
- Mail search, follow-up Done, card open/close persistence, settings save and digest install all still work.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — my-day side column done (S04-04 remainder). UX gate: 7 stacked
side cards vs mock's 2 — kept because each carries real functionality.
Write results/S04-23.md (<=10 lines); TL alone updates TRACKER.md.
