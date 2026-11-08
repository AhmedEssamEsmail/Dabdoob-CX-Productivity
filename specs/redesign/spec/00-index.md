# Spec index — redesign

Goal: replace the GAS-ported look with an authored "refined neutral" design layer (tokens → `theme.css`, shared classes → `cx-kit.css`, page families → `styles/<app>.css`) + a `components/ui/` React library + site-wide raw-control codemod. `globals.css`/`legacy-apps.css` stay imported during migration (authored files load last and win ties at equal specificity), then are retired in S12.

| Shard | File | Owner | Depends | Criteria | Files touched | Skills |
|---|---|---|---|---|---|---|
| S01 | 01-theme-tokens.md | dev | none | #1,#5,#6,#7 | `src/app/theme.css`, `src/app/layout.tsx` | web-design-guidelines |
| S02 | 02-shot-harness.md | dev | none | #4,#5 | `.devin/work/` only | webapp-testing |
| S03 | 03-cx-kit-css.md | dev | S01 | #1,#6,#7 | `src/app/cx-kit.css`, `layout.tsx` | web-design-guidelines |
| S04 | 04-ui-library.md | dev | S01 | #2 | `src/features/shared/components/ui/*` | react-best-practices |
| S05 | 05-hub-area.md | dev | S03,S04 | #1,#3,#6 | `styles/hub.css`, `cx-hub/components/*`, hub routes | none |
| S06 | 06-quality-area.md | dev | S03,S04 | #1,#3,#6 | `styles/quality.css`, `cx-quality/*`, quality routes | none |
| S07 | 07-queue-area.md | dev | S03,S04 | #1,#3,#6 | `styles/queue.css`, `cx-queue/*`, queue routes | none |
| S08 | 08-people-area.md | dev | S03,S04 | #1,#3,#6 | `styles/people.css`, `cx-people/*`, people routes | none |
| S09 | 09-ops-desk-areas.md | dev | S03,S04 | #1,#3,#6 | `styles/operations.css`,`styles/desk.css`, `cx-operations/*`, `cx-desk/*`, their routes | none |
| S10 | 10-productivity-area.md | dev | S03,S04 | #1,#3,#6 | `styles/productivity.css`, 4 app pages, `pv-shared.tsx` | none |
| S11 | 11-shell-auth.md | dev | S03,S04 | #3,#6 | `shared/components/shell/*`, `auth/*/page.tsx` | none |
| S12 | 12-retire-audit.md | dev | S03,S05–S11 | #1,#3,#6,#8 | `layout.tsx` + straggler fixes | none |
| S13 | 13-shots-capture.md | dev | S12 | #4,#5,#7 | `.devin/work/shots/redesign/` | webapp-testing |
| S14 | 14-ui-docs.md | tech-writer | S04,S13 | #2 | `docs/UI-SYSTEM.md` | none |

Waves: W1 = {S01,S02} · W2 = {S03,S04} · W3 = {S05,S06,S07,S08,S09,S10,S11} · W4 = S12 → S13 → S14 (sequential).

Cross-cutting rules every shard must obey:
- **DOM contract (e2e/golden parity):** never remove/rename roles, `aria-*`, `name`, `type`, `data-app`, `data-status`, `data-age`, ids, or class names. `ui/` components must merge-pass `className` (e.g. `<Button className="pv-item">` keeps `.pv-item`).
- **No new deps, no `package.json`/lockfile/`.env*` edits.** `supabase` untouched.
- `styles/*.css`/`theme.css`/`cx-kit.css` may contain hex/px values; **component `.tsx` code may not** (criterion #6 — tokens only).
- Next 16 CSS rules: `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` (global-CSS import order = cascade order).

Re-sharded ux-5 FIX leaves (supersede drafts `fix-ux-5-controls.md`, `fix-ux-5-fonts.md`; see TRACKER "Re-sharding"):
| Leaf | File | Kind | Owner | Depends | Criteria | Files touched | Skills |
|---|---|---|---|---|---|---|---|
| fix-ux-5-controls-native | fix-ux-5-controls-native.md | mini | dev | none | ux-5 native controls | `src/app/cx-kit.css` | none |
| fix-ux-5-swatches | fix-ux-5-swatches.md | mini | dev | none | ux-5 swatch tokens | `src/app/theme.css`, `src/app/styles/hub.css` | none |
| fix-ux-5-eco3-h1 | fix-ux-5-eco3-h1.md | mini | dev | fix-ux-5-swatches | ux-5 font-scale | `src/app/styles/hub.css` | none |
| fix-ux-5-fonts | fix-ux-5-fonts.md | mini | dev | none | ux-5 font-scale | `styles/people.css`, `styles/queue.css`, `styles/desk.css` | none |

NEEDS_USER: none.
