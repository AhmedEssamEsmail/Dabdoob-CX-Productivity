# fix-ux-5-controls — shared checkbox/radio styling + accent swatch tokens

> **Status: SUPERSEDED — do not dispatch.** tl-5 preflight FAIL (legacy format;
> 2 outcomes / 4 actions). Split into `fix-ux-5-controls-native.md`,
> `fix-ux-5-swatches.md`, `fix-ux-5-eco3-h1.md`. Content below is the
> authoritative fix spec those leaves implement.

Task slug: redesign. Mini-shard, UI fix.
Files: `src/app/cx-kit.css`, `src/app/theme.css`, `src/app/styles/hub.css`.

## Problem
- 32 raw `<input type="checkbox|radio">` kept across the app for native
  semantics have no shared styling — browser-default appearance outside
  `.pw-check` (people only). Sizes and accent color vary by browser/app.
- `hub.css` hardcodes 12 hex literals for accent/theme preview swatches
  (`[data-accent-preview]`, `.ap-swatch`) — the only place the accent palette
  exists outside tokens.

## Do
1. `cx-kit.css` — add shared rules:
   - `:root input[type="checkbox"], :root input[type="radio"]`:
     `width: 1.125rem; height: 1.125rem; accent-color: var(--cx-accent);`
     `cursor: pointer; flex: none; margin: 0;` and
     `:disabled { cursor: not-allowed; opacity: .55; }`.
   - Keep it a plain native-control restyle (accent-color + box size); do NOT
     build custom appearance/pseudo-element rendering. `.pw-check input` and
     `.cx-toggle` internals keep their own sizes (already consistent).
2. `theme.css` — add tokens (light + dark, near the accent-variant blocks):
   - `--cx-accent-pine: #1b4c45; --cx-accent-blue: #2b5797;
     --cx-accent-plum: #6b3a72; --cx-accent-rust: #9a4a1f;`
   - dark: `#3d8f76 / #7aa8f5 / #b78ad0 / #e0955c` under the existing dark
     `[data-accent]`/system-dark blocks.
   - `--cx-swatch-light-bg: #f6f8f7; --cx-swatch-light-fg: #1b4c45;
     --cx-swatch-dark-bg: #131b1d; --cx-swatch-dark-fg: #0c2623;`
3. `hub.css` — replace every hex literal in `[data-accent-preview="*"]` and
   `.ap-swatch` rules with the matching `var(--cx-accent-*)` /
   `var(--cx-swatch-*)` token. Swatches must render the SAME colors as today.
4. `hub.css` `.eco3-head h1`: `font-size:1rem` → `font-size:var(--cx-text-lg)`.

## Gates
`npx tsc --noEmit`, `npx eslint .`, `npx vitest run`,
`npx playwright test --config=tests/ui/playwright.config.ts`.

## Verify
- `grep -rnE '#[0-9a-fA-F]{3,8}' src/app/styles/hub.css` → 0 hits.
- Checkbox renders accent-colored check/fill in default + each `data-accent`.
