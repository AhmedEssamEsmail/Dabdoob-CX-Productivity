# ux report - ux-ui-audit-v2 - round 2 (DELTA, owned half)

**Verdict: PASS** — ux-1 MED corrected by ux1-01 CSS-contract patch; verified with rendered real-CSS fixture evidence (desktop 1280 / mobile 390, light + dark).
Open: 0B/0H/0M/2L (ux-2, ux-3 LOW — inherited, explicitly deferred per leaf "Out of scope"; unchanged this round).
Scope: leaf `spec/leaves.md#ux1-01` (`src/app/cx-kit.css` single additive rule) + owned header/Chip/Empty context re-check. No remote seeding/writes; fixture rendered locally via `file://`.

States checked (rendered): populated panel-head, canonical head-outside-panel, legacy `.card-head` parity, Chip tones + plain, Empty-in-panel, light/dark tokens, 1280/390 reflow + no-h-scroll. Not verified: live app routes, 200% zoom, real-data edge cases.

## Findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED→**CLOSED** | `cx-kit.css:549-552` `:root .cx-panel > .cx-section__head { padding: var(--cx-space-3) var(--cx-space-4); border-block-end: 1px solid var(--cx-line); }` | Inserted verbatim per contract, exactly between `.cx-section__hint` (:547) and `.cxp-fold` (:554); base `:534` head rule + zero `.tsx` edits confirmed. Rendered fixture (real `theme.css`+`cx-kit.css`+`refresh.css`, app order): head `padding 12px/16px`, `border-bottom 1px solid`; head-title left edge == padded-body left edge (209px vs 209px @1280, 41px vs 41px @390); canonical `cx-section` head stays `0px/0px`; `form.cx-panel` head (qa-shared:782 shape, `.card qa-form>.card-head` pre-migration) gets divider; 40/40 checks pass, `fails:0`. | — | — |
| ux-2 | LOW (open, deferred) | `.cx-empty` inside `.cx-panel` box-in-box + `p` margin reset + `max-width:34ch` drop | Unchanged — explicitly out of scope of ux1-01 (leaf line: "ux-2 `.cx-empty` + ux-3 `.trk-outside` LOW findings explicitly deferred per FIX rules"). Fixture case E still shows double border as logged. | As r1: `:root .cx-empty p { margin:0; max-width:34ch }`; optional transparent-in-panel rule. | dev (deferred) |
| ux-3 | LOW (open, deferred) | `trackers-page.tsx:732` `<Chip status="info" className="trk-outside">` — blue dot on grey chip | Unchanged — deferred. Chip base verified intact: `::before` dot renders (6px, status-colored), `--plain` hides it. | As r1: `plain` prop at site or `.trk-outside::before { background: currentColor }`. | dev (deferred) |

## Regression re-check (owned header/Chip/Empty context)

- **Coverage of `>` selector**: parsed all 69 `cx-section__head` sites — every in-panel head is a direct child of the `cx-panel` element (incl. combined `cx-panel cx-panel--pad` same-element cases and `form.cx-panel`); no `cx-panel--pad` *inner-div* wrapping a head exists, so no site is missed by the direct-child rule.
- **No over-application**: all canonical `section.cx-section > .cx-section__head` heads (overview-page:72,275,293,619; agents-page:660,793,888; qa-shared:168,1365; quality-analytics:962; aging:272; ui.tsx:160) render `padding:0/border:0` — untouched, as intended.
- **Parity**: legacy `.card-head` fixture (`14.4px/20px/1px`) — new chrome is the accepted canonical step-down (1rem inline aligns head text with `cx-panel--pad` body), not a regression.
- **Chips**: tones `ok/info/warn/bad/neutral` + `--plain` render per contract both themes.
- **Mobile 390**: head flex-wraps (title over hint), no horizontal scroll (`scrollWidth==clientWidth`).

## Evidence (all under `specs/ux-ui-audit-v2/`)

- `fixtures/ux-r2-fixture.html` — 6-case fixture loading real `src/app/{theme,cx-kit,refresh}.css` in app order.
- `fixtures/capture-ux-r2.mjs` — Playwright computed-style assertions (40 checks: light/dark × 1280/390).
- `logs/ux-r2-capture.log` — `fails: 0`, all checks `pass: true` (run `node fixtures/capture-ux-r2.mjs` from repo root).
- `shots/ux-r2-light-1280.png`, `ux-r2-light-390.png`, `ux-r2-dark-1280.png`, `ux-r2-dark-390.png` — rendered evidence incl. MailCard-shape healed panel vs canonical vs legacy reference.

## Not verified / assumptions

- Live Next.js routes not rendered (fixture + real CSS per handoff: "spot-render a migrated panel" — satisfied at component fidelity; no dev server / no remote writes).
- `git diff HEAD` on `cx-kit.css` shows prior-leaf header-comment edits too; ux1-01's diff hunk verified as the single new rule at :549-552 only.
- 200% text-zoom and real-data long-title wraps not re-measured (code-identical layout mechanics; flex-wrap confirmed at 390).
