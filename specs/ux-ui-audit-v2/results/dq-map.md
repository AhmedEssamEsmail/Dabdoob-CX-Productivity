# dq-map.md — S12-31 canonical map of live `dq-*` tokens

Source of truth: `grep -rEno 'dq-[a-z][\w-]*' src/features` (2025 audit tree). Excluded already error-gated `dq-needs|clear|spark|pct`. CSS homes: `src/app/refresh.css:542-605` (dq block), `src/app/cx-kit.css:1213-1222` (`.dq-head*`), `cx-kit.css:1542,1562-1568` (`.page,.dq-page`).

## Verdicts
- **→ `.page`** — `dq-page` is always co-emitted with marker `cxp` (bare `cxp` has NO css rule; it is a hook). `.page,.dq-page` selectors in cx-kit.css already pair the canonical class; swap token `dq-page`→`page`, then simplify selectors to `.page`.
- **→ `cx-*` rename** — no existing equivalent; rename class + move/rename the refresh.css rule to the `cx-` name.
- **keep-documented** — area skin worth a lint exemption (like `qa-*`/`tph-*`).
- **delete** — dead token/orphan rule, no visual change.

## Class table

| class | users (file:lines) | css rule | verdict |
|---|---|---|---|
| dq-page | 15 files — hub overview:430, people-holidays:254, agents:566, my-actions:129, my-status:86, prod-analytics:119, status-validation:320, tph-grid:222, audit-queue:202, qa-forms:364, qa-shared:141, aging:107, analytics:320, checkins:107, queue-page:392 (ALONE, no cxp) | cx-kit.css:1542,1562-1568 | → `.page` (queue-page gains `page`, keeps section) |
| dq-head | NONE (comment only: cx-queue/shared.tsx:4) | cx-kit.css:1213,1221-1222 (orphan) | delete token-in-comment + 3 orphan rules |
| dq-head__aside | none | cx-kit.css:1222 (orphan) | delete rule |
| dq-help | cx-queue/aging-page.tsx:25,36 | NONE (unstyled wrapper span) | delete token (unwrap or plain span) |
| dq-refresh | hub-shared.tsx:573; cx-queue/shared.tsx:388 (+comment :4) | refresh.css:544 | → `cx-refresh` (rename; shared refresh-controls widget, 2 consumers) |
| dq-totals | hub overview:151; quality-analytics:55,569 | refresh.css:546 | → `cx-totals` |
| dq-totals__item | overview:153; quality-analytics:57,84,91,102,109,120,130,570,577,585 | refresh.css:542,547-550 | → `cx-totals__item` |
| dq-stats | overview:165 | refresh.css:551,602 | → `cx-stats` |
| dq-stat (+__label/__row/__value/__delta) | overview:168,171,176,177,178,182 | refresh.css:552-560,558 | → `cx-stat*` |
| dq-agebar | overview:197; queue-page:110,115 (co-el `cc-sweep-bar`) | refresh.css:561-562 | → `cx-agebar` |
| dq-rowhead | overview:341; people-holidays:333; agents:379,731,860 | refresh.css:563 | → `cx-rowhead` |
| dq-sub | people-holidays:335,343,358; agents:74,124,128,132,136,384,390,399,752 | refresh.css:564 | → `cx-sub` |
| dq-groupbreak | overview:334; queue-page:319 | refresh.css:605 | → `cx-groupbreak` |
| dq-statusline | overview:351; checkins:148,211 | refresh.css:545 | → `cx-statusline` |
| dq-correct | checkins:153,154,184,185 | refresh.css:565 | → `cx-correct` |
| dq-editor, dq-editor__actions, dq-days, dq-holform | people-holidays:135,175,198,415 only | refresh.css:597-601,603 | keep-documented (holidays-editor area skin, single consumer) |
| dq-chartwrap, dq-chart, dq-chart__grid, dq-chart__axis, dq-ch, dq-ch--{call,chat,escalation} (template `dq-ch--${J/y}` analytics:155,371,376), dq-headline(+__num,__text), dq-split, dq-legend, dq-rank(+__head,__chip,__list,__n,__name,__track,__val,__share,__row), dq-crumb, dq-countries, dq-details | cx-queue/analytics-page.tsx ONLY (:101-393) | refresh.css:543,566-601,604 | → `cx-chart*`,`cx-headline*`,`cx-rank*`,`cx-legend`,`cx-split`,`cx-countries`,`cx-crumb`,`cx-details` (queue-analytics skin; co-el `card`/`cx-chip`/`cx-fieldset` stay) |

## Proposed leaf split (S12-DQ reshard; each ≤10 files, same-file serial)

- **DQ-1** `dq-page`→`page`: hub+people — overview, people-holidays, agents, my-actions (4 tsx). Drop token only.
- **DQ-2** `dq-page`→`page`: productivity+quality — my-status, productivity-analytics, status-validation, tph-grid, audit-queue, qa-forms, qa-shared (7 tsx). Drop token only.
- **DQ-3** queue `dq-page`→`page` + dead tokens + css: aging (also delete `dq-help`), checkins, queue-page (add `page`), cx-queue/shared.tsx (dq-head comment), cx-kit.css (`.page,.dq-page`→`.page`, delete `.dq-head*`) — 5 files. analytics-page's dq-page rides with DQ-6.
- **DQ-4** shared helper renames → `cx-*`: dq-totals*/dq-stats/dq-stat*/dq-agebar/dq-rowhead/dq-sub/dq-groupbreak/dq-statusline/dq-correct across overview, people-holidays, agents, checkins + refresh.css rules — 5 files, ~30 renames. SERIAL after DQ-1 on overview/people-holidays/agents/checkins.
- **DQ-5** queue-analytics family → `cx-*`: analytics-page.tsx + refresh.css — 2 files, ~70 tokens. Includes its dq-page→page. SERIAL vs DQ-3? different files except refresh.css — serialize css.
- **DQ-6** dq-refresh→cx-refresh: hub-shared.tsx, cx-queue/shared.tsx, refresh.css — 3 files. SERIAL vs DQ-3/DQ-5 on shared.tsx/refresh.css.
- **DQ-7** (post) keep-documented exemption for dq-editor/days/holform + final eslint `dq-` warn-pattern tightening once all tokens gone.
