# ux report - redesign - round 5 (DELTA)

Verdict: PASS
Open: 0B / 0H / 0M / 4L

Scope: tl-5 delta only — `src/app/cx-kit.css`, `src/app/theme.css`,
`src/app/styles/{hub,people,queue,desk}.css`. Foreign WIP elsewhere ignored.

## Verification of the four leaves

**fix-ux-5-controls-native (cx-kit.css:427-443).** Audited all 31 raw
`type="checkbox|radio"` call sites in `src/`. Every *visible* one sits inside a
`<label>` with flex gap (`pw-check`, `ap-check` min-block-size `--target`,
`qs-check` 44px, `dq-correct` 28px, `sch-check`, `hm-toggle`, ctls legend pick,
roster `#nu-active` via `htmlFor` label) — label+control form one hit target
≥24px, so 2.5.8 passes despite the 18px box. Every *hidden* input pattern
(`cx-toggle`/`cx-switch`/`cx-seg` `position:absolute;opacity:0`, `hm-chip`/
`trk-kind` `inset:0`, `ap-theme`/`ap-dot` 1px) is visually inert under the new
rule — equal specificity (0,2,1), and `inset:0`/logical sizes or invisibility
defeat `width`/`height`/`cursor`. Focus: global `:focus-visible`
(theme.css:430-437, incl. forced-colors override) covers visible inputs; hidden
inputs forward rings via `:focus-visible + span/track`. `accent-color` tracks
theme + all 4 `data-accent` choices; `color-scheme` set (theme.css:9/196/263) so
unchecked chrome follows the theme; forced-colors falls back to system colors —
safe. Disabled state (`.55` + `not-allowed`) verified; `flex:none` prevents
label-flex shrink — good. No `appearance`/pseudo-element hacks per contract.

**fix-ux-5-swatches (theme.css, hub.css).** `--cx-accent-{pine,blue,plum,rust}`
defined at `:root` and re-declared in BOTH dark blocks (explicit + auto media) —
values match the removed hub.css hex exactly; token swap is color-identical.
`--cx-swatch-*` defined once at `:root` is correct: theme-preview swatches must
always depict fixed light/dark looks. Remaining hex in hub.css (l.114-135) is
the `--eco3-*`/`--c` token-definition block — allowed by file convention; eco3
documented exemption (ux-14) unchanged.

**fix-ux-5-fonts (people/queue/desk.css).** Confirmed `globals.css`/
`legacy-apps.css` are NOT imported anywhere (layout imports only theme → cx-kit,
pages import `styles/*.css`), so the theme `:root` scale is authoritative and the
`[data-app] --cx-text-sm:.8125rem` pin (theme.css:421) is belt-and-braces.
Effective remaps: `.75→xs`, `.8125→sm`, `12px→xs`, `2.5rem→3xl` value-identical;
`.875→md` identical (.875); `.9375→md` = **.875** net (−1px, denser — recorded);
`1.125→lg` = 1.0625 (−1px, pw-h2). Only remaining authored literal:
`.sch-cell sup{font-size:.6em}` (queue.css:180).

**fix-ux-5-eco3-h1 (hub.css:167).** `1rem→var(--cx-text-lg)` = 1.0625rem — on
scale, h1 in glass overlay +6%. Cosmetic.

Web Interface Guidelines pass: no `transition:all`, no `outline:none`, native
semantics kept, label-wrap target rule satisfied, `color-scheme` both themes.

## Open findings

| ID | Sev | file:line | Evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| ux-18 | L | `src/app/styles/queue.css:180` | `.sch-cell sup{font-size:.6em}` — sole surviving off-scale font-size in authored styles (deliberate per tl-5; em-proportional so it tracks context). | Optional: `.6em`→`--cx-text-xs` equivalent or leave documented. | dev |
| ux-19 | L | `src/app/styles/people.css` (17 rules) | `.9375rem→--cx-text-md` resolves to **.875rem**, not .9375 — the legacy per-app scale (`--text-md:.9375` in dead `legacy-apps.css`) no longer loads. Mapping name implies parity; real effect is −1px on `.pw-tab/.pw-sub/.pw-check/.pw-summary/.pw-kv`. Direction matches "denser"; logged for accuracy. | None needed if −1px accepted (tl-5 recorded tightenings); else pin per-app `--text-md`. | dev |
| ux-20 | L | `src/app/styles/hub.css:167` | eco3 h1 `1rem→--cx-text-lg` is +6.25% (1.0→1.0625); tl-5 logged it under "tightenings". Doc slip only; visual delta trivial. | Correct tl-5 wording or accept. | dev |
| ux-21 | L | `src/app/cx-kit.css:432` + `queue.css:56` | `.hm-toggle input{margin-top:3px}` baseline offset survives only because page CSS loads after cx-kit at equal specificity (0,2,1) — `margin:0` would win if import order changed. Fragile coupling. | Optional: `margin-block-start:0`→scope, or raise `.hm-toggle input` specificity. | dev |

## Deferred LOWs carried from ux-4 (unchanged)

ux-11, ux-12, ux-13 (forced-colors input focus outline — theme.css:435-437
predates this delta; status unchanged), ux-14, ux-15.

## Not verified / assumptions

CSS-only delta: loading/empty/error/success states, long-text, responsive
320/768, RTL and full-route screenshots inherited from prior reviews + the
101-shot contract run — not re-exercised. No live app render this round;
`test:e2e`/`shoot-new` deferred per tl-5 (needs approved target). All computed
values traced through the live cascade (theme.css + cx-kit.css + page sheets)
by source, not browser measurement.
