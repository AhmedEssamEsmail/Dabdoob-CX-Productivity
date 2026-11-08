# ux report - redesign - round 3 (DELTA)

Verdict: **FAIL**
Open: **0B / 0H / 1M / 5L**

States checked (DELTA — tl-4 changed-file scope: `src/app/cx-kit.css` only): toggle checked label/icon/border contrast across all 8 theme×accent pairs, focus-visible on hidden input, checked-state non-color cues (bg + `✓` + weight). Sweep of every remaining `color: var(--cx-accent)` site for the same accent-on-dark class of bug.

## Prior findings — verification

| ID | Status | Evidence |
|---|---|---|
| ux-16 MED toggle checked text | **FIXED** | `cx-kit.css:365` now `color: var(--cx-accent-hover)`. Recomputed (sRGB approx of oklab mixes): dark pine `#59b795` on soft `#203638` ≈**5.25:1**; light pine ≈11.5; light blue ≈8.3; plum ≈9.2; rust ≈7.15; dark blue ≈5.9; plum ≈5.5; rust ≈5.7 — all ≥4.5:1 (1.4.3). Border stays `--cx-accent` (≈3.3:1 vs soft, ≥3:1 1.4.11) and checked state still signaled by bg + `✓` + weight — not color-only. Now consistent with `.cx-seg` (:334). |
| ux-11..15 LOW | OPEN (deferred) | Unchanged; still deferred per tl-3/tl-4. |

## New findings

| ID | Sev | file:line or route+element | Evidence (measured / code) | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-17 | MED | `src/app/styles/hub.css:84` `.md-link`; `src/app/styles/queue.css:291` `.dq-crumb` | Link/breadcrumb text in `--cx-accent`. **Dark pine (default accent): `#3d8f76` on `--cx-surface` `#1a232b` ≈4.08:1 <4.5:1** (1.4.3); on `--paper` ≈4.51 — fails wherever the link sits on a card/panel. All other 7 theme×accent pairs pass (≥6.3:1). Same class of bug as ux-16: `--cx-accent` used as text color in dark theme. | Change both to `color: var(--cx-accent-hover)` (dark pine ≈5.25:1, light ≈6.4+:1; matches nav-link/seg convention). | dev |

Clean checks: `.nav-link[aria-current]` (:913) already uses `--cx-accent-hover`; `.nav-icon` (:950) is non-text — `#3d8f76` on soft ≈3.28:1 ≥3:1 (1.4.11) ✓; `.hm-total-n` (queue.css:71) is large text (3xl) — ≥3:1 ✓; `.cx-btn--primary` uses `--cx-accent-ink` on accent ✓; `border-color: var(--cx-accent)` sites (:163,:364,:401,:438, productivity.css:10) are UI boundaries ≥3:1 ✓.

## Not verified / assumptions
- Contrast via sRGB approximation of `color-mix(in oklab,…)` (±0.1–0.2); ux-17 at 4.08 sits on real cards so the <4.5 call holds even with tolerance.
- `.md-link`/`.dq-crumb` assumed to render on `--cx-surface`/panel backgrounds per sibling markup; on pure `--paper` they pass marginally.
- ux-11..15 and prior deferred LOWs not re-audited; no new shots run (deterministic code audit per tl-4 delta).
