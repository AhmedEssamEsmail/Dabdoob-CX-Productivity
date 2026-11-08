# Contract violations — redesign shot pass (S13)

Source: `.devin/work/shots/redesign/contract-report.json` (101 shots, `node .devin/work/shoot-new.mjs`, 2026-11-08).
Contract under test (PLAN #5/#6): `--cx-target` = 36px fine / 44px coarse, first button `min-height == target`, `border-width == 1px`, first table row `<= 36px`, first `td` font `~13px`.

## Summary

- 101/101 shots captured, `_index.json` `errors: []` on every entry.
- `target`, `btnMinH`, `btnBorderW`, `baseFont` pass everywhere they are measurable.
- **Systematic row-height violation**: first visible `table tr` measures 45–50.5px on 21 routes (both themes). Likely the probe hits a header/`th` row or rows carry extra padding — needs source-side check (not fixed here per shard scope).
- **Ecosystem**: first `button` match is an `eco3-tag eco3-s-down eco3-tag--hub` scene annotation (h=27.8px, `min-height: 0`) — probably exempt by design, flagged for review.
- **no-access**: state screen contains no button/table/td — contract probes N/A (informational, not a violation).
- 58 shots have no table/`td` on the page at all (rowH/baseFont `null`) — N/A, not violations.

## Violations (page — property — actual)

### rowH > 36px (contract: data-table rows ≤ 2.25rem / probe ≤ 36px)

| Page | Variants affected | Actual rowH |
|---|---|---|
| admin/config | light, dark | 45px |
| admin/roster | light, dark | 45px |
| agents | light, dark | 45px |
| aging | light, dark | 45px |
| analytics | light, dark | 45px |
| calibration | light, dark | 45px |
| coaching | light | 45px |
| ctls | light, dark | 45px |
| disputes | light, dark | 45px |
| kb-gaps | light, dark | 45px |
| mail-desk | light, dark | 48.5px |
| my-auditor-kpis | light, dark | 45px |
| notes | light, dark | 45px |
| people-holidays | light, dark | 45px |
| qa-forms | light, dark | 45px |
| quality-analytics | light, dark (+dark only had table) | 45px |
| quality-scores | light, dark | 45px |
| queue | light, dark, mobile, rtl | 45px |
| status-validation | light, dark, mobile, rtl | 45px |
| tl-performance | light | 48.5px |
| trackers | light, dark | 50.5px |

Note: `quality-analytics` light shot had no table (`rowH null`); dark measured 45px. `coaching`/`tl-performance` dark shots had no visible table row.

### btnMinH != target

| Page | Variants | Actual | Note |
|---|---|---|---|
| ecosystem | light, dark | 0px | First `button` is `eco3-tag` 3D-scene label (h=27.8px), not a ui/ control — likely exempt, confirm intent |

### Probe N/A (no matching element — informational)

- `no-access` (light): no `.cx-btn`/`button`, no `table tr`, no `td` on the no-access state screen.

## Harness note

`shoot-new.mjs` mobile contexts now set `hasTouch`/`isMobile` so `(pointer: coarse)` matches — mobile shots correctly report `target=44`, `btnMinH=44`. Before this fix they reported the fine-pointer 36px contract.

## Visual anomalies (representative-shot review)

Reviewed DOM/style dumps for home, overview, queue, tph, agents, quality-scores, trackers, ecosystem, auth-login, no-access (both themes where applicable) plus all 3 RTL shots:

- Theme switching verified: light `body` bg `rgb(246,247,248)` / dark `rgb(19,26,32)`; rail `rgb(255,255,255)` / `rgb(26,35,43)` — consistent, no pine/legacy accent leftovers (zero `pine` matches across all `.styles.json`/`.dom.txt`).
- RTL (`home-rtl`, `status-validation-rtl`, `queue-rtl`): `documentElement.dir=rtl`, `lang=ar`, Arabic chrome strings render ("انتقل إلى المحتوى", "القائمة"), shell/nav structure intact — no broken chrome observed.
- `auth-login` and `no-access` render without the rail (expected standalone screens); `ecosystem` is a full-screen scene page (no rail — expected).
- No unstyled raw-element anomalies detected in sampled dumps; all PNGs non-trivial size (21KB–200KB).
