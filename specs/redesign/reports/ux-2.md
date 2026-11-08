# ux report - redesign - round 2 (DELTA)

Verdict: **FAIL**
Open: **0B / 0H / 1M / 5L**

States checked (DELTA — code audit of `src/app/cx-kit.css`, `src/app/theme.css` vs tl-3 changed-files list): focus rings on hidden inputs, checked/disabled states, input borders, collapse breakpoints 1180/900/600, `.cx-seg` wrap, `tr[data-age]` tint+stripe, `.pending` RTL padding, `.cx-btn--small`/`--icon` authored, `--cx-ink-3`/`--cx-accent-hover` contrast recomputed. Dark + light, all 4 accents where relevant.

## Prior findings — verification

| ID | Status | Evidence |
|---|---|---|
| ux-1 BLOCKER `.cx-toggle` | **FIXED** | cx-kit.css:343-375 — pill (`min-height:var(--cx-target)`, 1px `--cx-line-strong`, radius 999px), `input:checked+span` accent-soft+accent border+`✓::before`, `input:focus-visible+span` outline. But see **ux-16** (checked text color). |
| ux-2 HIGH focus on hidden inputs | **FIXED** | `:focus-visible` sibling rules present for seg (:338), toggle (:372), switch→track (:407). |
| ux-3 HIGH field border contrast | **FIXED** | :265 `border:1px solid var(--cx-line-strong)`; `--line-strong:#828a96` → measured ≈**3.48:1** vs surface, ≈3.19:1 vs paper (light), ≈4.6:1 vs dark surface — all ≥3:1 (1.4.11). |
| ux-4 MED `--cx-ink-3` | **FIXED** | theme.css:134 mix now 85% → ≈4.8:1 light / ≈5.0:1 dark (recomputed). |
| ux-5 MED dark pine accent pair | **FIXED** | :216/:279 `--cx-accent-hover:#59b795` → ≈**5.28:1** on accent-soft. |
| ux-6 MED dead btn variants | **FIXED** | cx-kit.css:198-205 `:root .cx-btn--small` (2rem/xs) + `.cx-btn--icon` (square `--cx-target`, svg sized). |
| ux-7 MED collapse breakpoints | **FIXED** | :690-700 all three blocks ported incl. `.cx-hc__*`, `.cx-assume__grid`, `.cx-typecards` @600. |
| ux-8 MED `.cx-seg` wrap | **FIXED** | :313-315 `flex-wrap:wrap; max-inline-size:100%` restored. |
| ux-9 MED `tr[data-age]` | **FIXED** | :595-596 `--age-tint` bg + `--age-stripe` `border-inline-start` re-added; tokens live again. |
| ux-10 MED `.pending` RTL | **FIXED** | :535 `padding-inline-start:var(--cx-space-4)` logical. |
| ux-11..15 LOW | OPEN (deferred) | Unchanged; tl-3 deferred with rationale — still logged. |

## New findings

| ID | Sev | file:line or route+element | Evidence (measured / code) | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-16 | MED | `src/app/cx-kit.css:362-366` `.cx-toggle input:checked + span` | Uses `color: var(--cx-accent)` on `--cx-accent-soft`. **Dark pine**: `--cx-accent`=`--pine-2` `#3d8f76` (L≈0.220) on soft `#213638` (L≈0.032) → **≈3.27:1 <4.5:1** (1.4.3) — checked label + `✓` under-readable on people-holidays/audit toggles. Seg checked (:334) correctly uses `--cx-accent-hover` (5.28:1); toggle is inconsistent. Light pine 5.3:1 ✓; dark blue/plum/rust pass (light accents on dark soft). | Change :365 to `color: var(--cx-accent-hover)` (border may keep `--cx-accent`, 4.1:1 vs surface ≥3:1). | dev |

## Not verified / assumptions
- Contrast computed via sRGB approximation of `color-mix(in oklab,…)` (±0.1–0.2); ux-16 at 3.27:1 is far enough under 4.5 to hold.
- No new shots run; verification is deterministic code/style audit per tl-3 delta (2 CSS files only).
- Prior LOWs ux-11/12/13/14/15 and qa-4/5/6/7 remain deferred, not re-audited.
