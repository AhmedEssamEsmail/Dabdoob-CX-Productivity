# tl-5 — BUILD: fix-ux-5 batch (4 mini leaves, CSS-only)

## Outcome
**ALL 4 LEAVES DONE — gates PASS.** Prior round ended RESHARD_NEEDED on the
two legacy drafts; spec-architect re-issued four compliant `Kind: mini`
leaves, dispatched this round.

## Preflight
- `check_shards.py` on all four leaves → PASS (structure).
- Semantic vs LIMITS: 1 outcome each; ≤3 files; ≤3 actions; ≤200 lines;
  ≤15 min. people.css 17-rule remap judged one atomic codemod action
  (mechanical literal→`var()` mapping on one declaration property).
- Baseline dirty tree: specs-only artifacts; src/ clean at dispatch.

## Dispatch (waves by file overlap)
| Leaf | Files | Diff | Leaf Verify | Status |
|---|---|---|---|---|
| fix-ux-5-controls-native (W1) | `src/app/cx-kit.css` | +18 | `accent-color` 1 hit (l.434); no `appearance`/pseudo-elements | done |
| fix-ux-5-swatches (W1) | `src/app/theme.css`, `src/app/styles/hub.css` | +16/+14 | hub.css hex → only 9 `--eco3-*`/`--c` remain (l.114-135) | done |
| fix-ux-5-fonts (W1) | `src/app/styles/{people,queue,desk}.css` | +20/-20 | `font-size:<num>` → 0 hits; `.6em`/`.7em` kept | done |
| fix-ux-5-eco3-h1 (W2, after swatches — hub.css serial) | `src/app/styles/hub.css` | +1/-1 | literal `font-size` → 0 hits; `--cx-text-lg` at l.167 | done |

Delivered: shared `:root input[type=checkbox|radio]` restyle (1.125rem,
`accent-color:var(--cx-accent)`, disabled state) inert on hidden
`.cx-toggle`/`.cx-switch` inputs; 8 `--cx-accent-{pine,blue,plum,rust}` +
`--cx-swatch-*` tokens published in theme.css (light + both dark blocks);
hub.css swatch/preview rules tokenized (colors identical); all authored
font-size literals on the `--cx-text-*` scale (`.9375→md`, `1.125→lg`,
`1rem→lg` tightenings recorded).

## Integration gates (TL-run, after all writers finished)
- `npx tsc --noEmit` PASS · `npx eslint .` 0 err/370 pre-existing warnings
- `npx vitest run` 1141 PASS (47 files) · `npm run test:security` 22 PASS
- `npx next build` PASS (exit 0)
- Scope: `git status` — only the 6 declared CSS files changed in src/.
- DEFERRED: `npm run test:e2e`, `node .devin/work/shoot-new.mjs` — need
  live/approved target (harness resets users, upserts remote roster);
  acceptable risk: value-identical token swaps + additive CSS rules.

## Notes
- No review-gate work; no commits. Owner attempts: 1 each, no resumes.
- Superseded drafts (`fix-ux-5-controls.md`, old `fix-ux-5-fonts.md`)
  remain in spec/ as historical; Re-sharding table in TRACKER records it.
