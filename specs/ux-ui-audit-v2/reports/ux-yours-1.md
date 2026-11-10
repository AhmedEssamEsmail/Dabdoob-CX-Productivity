# ux report - ux-ui-audit-v2 - round 1 (DELTA, owned half)

**Verdict: FAIL** — one MED open, inherited from the approved `card-head → cx-section__head` mapping contract (spec-level, not worker execution).
Open: 0B/0H/1M/2L
Scope: S07-15/16/17, S12-20/22/23/24/25/26/28/29/30/33, S14-07 (S12-27 superseded→S12-33). TL evidence: tl-yours r6 (tsc 0, eslint 0 err/526 warns, vitest 1196/1196, build 156/156, goldens 169/169, a11y e2e 3/3).

States checked (code-level): empty, disabled, long text, keyboard, focus, token/dark-mode parity, class-name parity vs loser rules. Not verified: rendered pixels, 320px reflow, 200% text — see Not verified.

## Findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | `cx-section__head` inside un-padded `cx-panel`, ~50 sites: e.g. `my-day-page.tsx:351-357,579,689,759,858`; `overview-page.tsx:500,536,574`; `admin-roster-page.tsx:114,200`; `admin-config-page.tsx:68`; `people-holidays-page.tsx:282,406`; `agents-page.tsx:694`; `coaching-page.tsx:98`; `one-on-ones-views.tsx:2087,2142,2158,2392,2444`; `meetings-page.tsx:834`; `quality-analytics-page.tsx:45-53`; `audit-queue-page.tsx`; `qa-shared.tsx`; `ctls-page.tsx` ×3; `disputes-page.tsx` ×3; `quality-scores-page.tsx` ×5; `aging-page.tsx:152,205`; `queue-page.tsx` ×2; `scheduler/heatmap/checkins` ×1 each; `productivity-analytics-page.tsx` ×6; `status-validation-page.tsx` ×2; `my-status-page.tsx` ×3 | `.card-head` = `padding:.9rem 1.25rem; border-bottom:1px solid var(--cx-line)` (refresh.css:161-164); `.cx-section__head` has **no padding, no border** (cx-kit.css:534-540) and `.cx-panel` has none either (cx-kit.css:524-530). Verbatim contract swap (leaves.md#S12-22 "same elements/tags, classes only") leaves head text flush to the panel border, misaligned with the `cx-panel--pad` body, divider gone. Canonical siblings put the head *outside* the panel inside `cx-section` (overview-page.tsx:274-282, qa-shared.tsx:167-168 `QaSection`) — migrated sites diverge from both old look and canonical pattern. | Spec decision, then either (a) add `:root .cx-panel > .cx-section__head { padding: var(--cx-space-3) var(--cx-space-4); border-block-end: 1px solid var(--cx-line); }` to cx-kit.css (smallest diff, preserves DOM), or (b) restructure to canonical `cx-section` (head above panel) per DECISION B. | spec-architect + dev |
| ux-2 | LOW | `.cx-empty` inside `.cx-panel` → double-bordered box-in-box: `audit-queue-page.tsx:364-365`, `my-actions-page.tsx:140-141`; also `Empty` `<p>` body keeps UA `margin-block:1em` (no reset found in theme/cx-kit/refresh) and `.cx-empty` drops the old `.empty .s { max-width:34ch }` (refresh.css:65) so body copy spans full width | refresh.css:58-65 vs cx-kit.css:799-814 | In `cx-kit.css`: `:root .cx-empty p { margin:0; max-width:34ch }`; optionally `:root .cx-panel > .cx-empty { border:0; background:transparent }` (or migrate such sites to bare `Empty` without panel wrapper). | dev |
| ux-3 | LOW | `trackers-page.tsx:732` `<Chip status="info" className="trk-outside">` | `.trk-outside` overrides bg/color to grey dashed (operations.css:26) but `.cx-chip::before` dot resolves `--st-edge`=info-edge → blue dot on grey chip; old `.pill::before` used `currentColor` (refresh.css:240-243) and matched. | Add `plain` prop (no dot) at this site, or scope `.trk-outside::before { background: currentColor }` in operations.css. | dev |

## Verified — parity PASS items (no findings)

- **Chip API/tones**: `data-status` → `--st-fg/bg/edge` → `--cx-status-*` (cx-kit.css:42-66) = same tokens `.pill.*` used; `neutral` ≈ `#46546a` on `#e6eaf1` ≈ 5.9:1 (≥4.5). `no-dot`→`plain`→`cx-chip--plain` parity; `acc`→`info` canonical (slight hue shift, intended). `StatusChip` is a Chip delegate (StatusChip.tsx:13-21) — consistent. Dynamic tones correctly narrowed to `ChipStatus` (admin-roster:249, one-on-ones:300, my-status flagPill, scheduler StatusPill:52, qa-forms:441 `status={l.active?'ok':undefined}`).
- **`card`→`cx-panel`**: identical surface tokens + `min-width:0` gain. `card-pad`→`--pad` = 1.1rem/1.25rem→1rem uniform (canonical spacing, ~4px tighter — acceptable). `card-hint`→`__hint` darkens `--cx-ink-3`→`--cx-ink-2` (contrast improvement). `-card`-suffixed skins (`qa-card*`, `md-card*`, `pv-card*`, `tph-card*`, `login-card`) correctly untouched.
- **`empty`→`Empty`**: `title=`/`body=` mapping correct incl. template-literal titles (audit-queue-page.tsx:330-332) and `className` passthrough (`qa-cols__none`, quality-analytics-charts.tsx:176-179). Renders `strong` title + optional body/icon/action — semantics ≥ old divs.
- **S07-15**: `qs-hero--flat` (quality.css:192) collapses hero grid same as its 1180px media twin — consistent; `<Empty>` inside `figure.qa-trend` legal.
- **S07-16**: `dl.cx-totals` keeps valid `dl>div>dt/dd`; dead `p` ref/`qa-cov-wrap` fully removed; `qa-health-h` aria-labelledby pair live.
- **S07-17**: `qa-sampling`→`qa-details-panel` rename clean — zero stale tokens in markup or quality.css; `details`/`summary` keyboard-native.
- **A11y changed regions**: `md-cardtoggle` = real `<button>` + `aria-expanded`/`aria-controls` + `:focus-visible` ring (hub.css:78-81); `ih()` aria-controls dropped when collapsed (target absent) — sound; sections use `aria-labelledby` (works though `cx-section__title` is a `<div>` — same as before). Chip = non-interactive span, correct.
- **S14-07**: a11y-keyboard e2e 3/3 (Tabs roving, PaintGrid arrow-nav on /tph, palette focus restore) — log evidence, no remote writes.

## Inherited whole-task blockers (not delegated-leaf defects)

- `.card*`/`.pill`/`.empty` rules still live in refresh.css — dead CSS until **S12-32** (pending DQ-6 + eslint ratchet); orphaned but harmless (no markup users).
- ux-1 above is a spec-contract defect: workers executed the leaves.md mapping verbatim and correctly; remediation needs spec-architect decision (CSS patch vs restructure), so it blocks the *task*, not the leaf workers.

## Not verified / assumptions

- No rendered screenshots/browser pass this round (code-level DELTA); 1.4.4 resize-200%, 1.4.10 reflow-320px, 2.4.7/2.4.11 live-focus, and ux-1's pixel severity were judged from CSS/DOM only — a screenshot pass would firm it up.
- Contrast not re-measured: chip/panel tokens already baselined in shared-tokens audit; only `neutral` computed here.
- `<dl>` item trailing `<span class="qa-sub">` sibling to `dt`/`dd` inside the wrapper div is technically non-conforming HTML (quality-analytics-page.tsx:78) but pre-dates these leaves — not a delta finding.
- `qa-forms-page.tsx:455` `<Empty>` inside `<td>` — legal markup, cosmetic box-in-cell noted under ux-2's pattern.
