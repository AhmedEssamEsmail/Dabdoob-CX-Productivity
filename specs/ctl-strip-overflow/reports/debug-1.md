# debug report - ctl-strip-overflow - 1

Verdict: ROOT_CAUSE_FOUND

Repro: `tests/ui/qa-strip-overflow.pw.ts` (new; real CSS + faithful strip markup in the
existing `tests/ui` isolated-document harness, chromium) — **fails now**:
`document scrollWidth 1691 exceeds clientWidth 1400` at a 1400px viewport;
strip rows render wider than `.card-pad`, `.qa-acts` buttons land off-screen
right. Matches the reported document-level horizontal scrollbar exactly.
Command: `cd tests/ui && npx playwright test --config playwright.config.ts qa-strip-overflow.pw.ts --project=chromium` (exit=1).

Root cause: `src/app/styles/quality.css:217` —
`[data-app="quality"] .qa-list { display:grid;gap:var(--cx-space-2) }` creates an
implicit single `auto` column. An `auto` track's floor/growth limit is the
largest grid item's content contribution; `article.qa-card--strip` is a nowrap
flex row (`.qa-name`, `.qa-meta{white-space:nowrap}`, pills, `.qa-acts` all
`flex:none`) whose contribution ≈ full max-content (~2x card width), so the
track overflows `.card-pad`. `.card`/`.card-pad`/`.dq-page` are plain
`overflow:visible` blocks (refresh.css:162–166, cx-kit.css:1445), so the
overflow propagates to document scroll. `.qa-meta{flex:1;min-width:0}` never
engages because the track is already oversized. Introduced by e41f9f1 (git
show: `.qa-list` added in that commit; the pre-existing `minmax(0,1fr)` idiom
is used everywhere else — quality.css:44 `.qa-ctl`, hub.css:15–16 `.md-layout`/
`.md-main`).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| dbg-1 | HIGH | src/app/styles/quality.css:217 | `.qa-list` implicit `auto` column sizes to strip max-content → rows + buttons overflow card → document h-scroll. Probe: scrollWidth 1691→1400 after `grid-template-columns:minmax(0,1fr)`; `.qa-acts` right edge 1358px (on-screen); meta clipped (scroll==client 536); details `<summary>` right 1370 ≤ list right 1371; clean at 800px viewport | `src/app/styles/quality.css:217` → `[data-app="quality"] .qa-list { display:grid;grid-template-columns:minmax(0,1fr);gap:var(--cx-space-2) }` (one-line change; `min-width:0` on grid items verified unnecessary) | dev |

Regression test: `tests/ui/qa-strip-overflow.pw.ts` — **failing now**
(exit=1, scrollWidth 1691 > clientWidth 1400). Asserts: no document h-scroll,
every `.qa-card--strip` right edge ≤ `.qa-list` right edge, `.qa-acts` box
inside a 1400px viewport, `.qa-meta` overflow hidden.

Siblings: `.qa-list` is shared — `disputes-page.tsx:162` and
`my-audits-page.tsx:164,183` (details variant) get the same fix for free;
verified in-fixture (summary row stays inside list). Latent same-pattern
single-column grids without `minmax(0,…)` tracks exist at quality.css:32
`.qa-cards,.qa-card`, :41 `.qa-ctlbox`, :43 `.qa-ctlform`, :51
`.qa-ctlside__body`, :53 `.qa-pick`, :65 `.qa-builder`, :118
`.qa-sampling__body`, :166 `.qa-whylist`, :191 `.qs-facts`, :233 `.qa-detail`
— none have nowrap max-content children today, so no visible bug; list only.

Fix risks / what could regress: one-line CSS change, zero markup impact.
Media query at :237–239 (≤64rem wrap) unaffected — verified at 800px.
`.qa-detail` expansion inherits the constrained track (full width, correct).
By-design residual: a `.qa-name` longer than the card can still clip (name is
`nowrap`+`flex:none`; per spec intent meta truncates, not the name).
Gates after fix: `npx tsc --noEmit`, `npx eslint .`, visual check, ui gate.
