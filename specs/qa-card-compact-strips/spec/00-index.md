# Spec index: qa-card-compact-strips
Kind: index
Size gate: PASS

Restyle `qa-card` items on the CTLs, Disputes and My-audits Quality pages into
the user-approved "Option A" compact strips (mockups `mockups/ctl-compact/a.html`,
`mockups/disputes-compact/a.html`). S01 publishes the shared CSS contract;
S02–S04 are the page consumers and run in parallel after S01.

| ID | Kind | Spec/index path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | mini | 01-quality-strip-css.md | dev | none | #4 (strip CSS family, token-based) | 1/3/70/8 |
| S02 | mini | 02-ctls-strip.md | dev | S01 | #1, #4 (pure strip), #5 | 1/5/140/10 |
| S03 | mini | 03-disputes-strip.md | dev | S01 | #2, #4 (collapsible strip), #5 | 1/5/110/10 |
| S04 | mini | 04-my-audits-strip.md | dev | S01 | #3, #4 (collapsible strip), #5 | 1/5/110/10 |

Ready work: S01 now; S02+S03+S04 in parallel after S01 (distinct files; max 4
workers). No shared-file writes between parallel leaves.

Shared class contract (defined in S01, consumed verbatim by S02–S04):
`.qa-list` (list container), `.qa-card--strip` (item modifier on `.qa-card`;
`<article>` = the flex row itself, `<details>` = block wrapper whose `<summary>`
is the flex row), `.qa-chev`, `.qa-name`, `.qa-meta` + `.qa-sep`, `.qa-note-txt`,
`.qa-acts`, `.qa-detail`, `.qa-cap`. Item className is always
`"qa-card qa-card--strip"` — `card`/`card-pad` are NOT used (mock `.mk-item`
parity: surface + line border + radius, no shadow/pad).

Gates (PM-run, repo root): `npx tsc --noEmit`; `npx eslint src/features/cx-quality
src/app/styles`; `npx vitest run` (log to file, bounded tail); `ui` flag → UX/UI
gate after build.

Size gate evidence: every leaf reviewed against LIMITS.md — each edits 1 named
file, ≤5 actions, ≤5 checks, ≤160 changed lines, ≤10 min, ≤5 context pointers.
No package needed (4 direct leaves). Checker to be run by PM/TL pre-dispatch:
`python "C:\Users\AHMED\AppData\Roaming\devin\skills\spec-sharding\check_shards.py"
spec/01-quality-strip-css.md spec/02-ctls-strip.md spec/03-disputes-strip.md
spec/04-my-audits-strip.md`.
