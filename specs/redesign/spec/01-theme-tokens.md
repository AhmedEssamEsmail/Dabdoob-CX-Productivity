# 01-theme-tokens   (shard id: S01)
Owner: dev     Depends: none     Criteria: PLAN #1,#5,#6,#7
Skills: C:\Users\AHMED\.copilot\skills\web-design-guidelines\SKILL.md

## Goal
Author `src/app/theme.css` — the single source of truth for every design token (refined-neutral palette, one accent, type scale, radii, shadows, spacing, motion, status/age colors, density) in light AND dark — and wire it into the cascade.

## Files
Edit/create ONLY: `src/app/theme.css` (new), `src/app/layout.tsx`
Read-only context: `src/app/globals.css:1-8` (legacy token names to supersede), `src/app/legacy-apps.css:209-213,481-485,1385-1389` (per-app token re-declares + dark pattern to beat), `src/features/shared/shell/i18n.ts:51-62` (applyAppearance attrs), `src/app/legacy-apps.css:93-165` (eco3 rail tokens), `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` (global-CSS import order)
Forbidden: everything else, `globals.css`/`legacy-apps.css` themselves (generated; do not hand-edit), manifests/lockfiles, `.env*`

## Steps
1. Direction (CTO-chosen): **refined neutral ops console** — clean surfaces, hairline 1px borders, ONE restrained accent, tight type hierarchy, no gradient washes, **denser** than today. IBM Plex Sans stays (`--cx-font-ar` keeps IBM Plex Sans Arabic).
2. Create `src/app/theme.css` defining at `:root` (light) every token the sheets use, under these names so old rules pick up new values automatically:
   - primitives: `--paper`,`--surface`,`--ink`,`--ink-2`,`--line`,`--pine`,`--pine-2`,`--pine-ink`,`--signal`,`--signal-ink`,`--signal-hover`,`--ok`,`--focus`,`--danger`,`--hover`,`--scrim`,`--age-0..6`,`--shadow-1..3`,`--font`,`--font-mono`,`--text-xs..3xl`,`--text-base`,`--text-title`,`--lh-*`,`--w-*`,`--space-1..8`,`--radius-s/m/l`,`--ease`,`--dur-fast`,`--dur`,`--dur-slow`,`--cc-sweep`,`--cc-stagger`,`--rail-w`,`--rail-w-mini`,`--gutter`,`--main-pad`,`--fill-h`,`--page-max`,`--page-narrow`,`--dialog-s/m/l`,`--target`,`--line-strong`.
   - `--cx-*` aliases mirroring globals.css:8 (fonts, weights, lh, spaces, gutter, radii, rail/topbar, surfaces, inks, lines, accent set, focus, `--cx-shadow-pop`, `--cx-status-{neutral,info,ok,warn,bad}-{fg,bg,edge}`, `--cx-age-*`, `--cx-age-ink-*`).
   - Set `color-scheme: light` on `:root`.
3. Density contract (criterion #5): `--cx-target: 2.25rem` and `--target: 2.25rem` at `:root`; `@media (pointer:coarse){ :root{ --cx-target:2.75rem; --target:2.75rem } }`. Base data font: set `font-size: .8125rem` on `table,.cx-table` inside theme.css. `--cx-text-sm` may drop to `.8125rem`.
4. Dark: `html[data-theme="dark"]{ …full token redeclare…; color-scheme:dark }` AND `@media (prefers-color-scheme:dark){ html:not([data-theme="light"]){ …same… } }` (auto mode).
5. Accent variants (behaviour contract — Appearance UI offers 4): `html[data-accent="blue"|"plum"|"rust"]{ --cx-accent, --cx-accent-hover, --cx-accent-soft, --pine-2, --pine }` remaps; default (no attr) = new pine-like restrained accent. Dark variants too.
6. Re-pin at app scope so per-app re-declares in `legacy-apps.css` lose: `[data-app]{ --cx-target:2.25rem; --target:2.25rem; --cx-radius-control:<new>; --cx-text-sm:<new> }` (same specificity, theme.css loads later). Also `@media (pointer:coarse){ [data-app]{ --cx-target:2.75rem; --target:2.75rem } }`.
7. Honour `html[data-reduce-transparency]` (kill translucency/`backdrop-filter`) and `html[data-reduce-motion]` + `@media (prefers-reduced-motion:reduce)` (zero `--cx-dur`, `--cx-ease`, `--cc-sweep`).
8. Use logical properties everywhere; add `:root{ --cx-focus-ring: 0 0 0 2px var(--cx-surface), 0 0 0 4px var(--cx-focus) }` or equivalent AA-visible ring for `focus-visible`.
9. In `src/app/layout.tsx` add `import "./theme.css";` AFTER `import "./legacy-apps.css";` (line 3). Do not remove the legacy imports — S12 retires them.
10. Sanity: `npm run dev`, open `/auth/login` in light+dark, confirm new palette + `--cx-target` = 2.25rem.

## Done when
- `theme.css` defines every listed token for light+dark(+auto), accents, density contract, focus ring, reduced-motion/transparency hooks.
- `layout.tsx` imports it last of the three css files; `npx next build` exits 0.
- Verify: `npx next build` -> compiled; in devtools `getComputedStyle(document.documentElement).getPropertyValue('--cx-target')` -> `2.25rem` (fine pointer).
