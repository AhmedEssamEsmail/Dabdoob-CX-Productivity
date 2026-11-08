# FUX-15: AppShell + AR dict — deferred LOWs ux-11 markup, ux-12, ux-13, ux-14
Kind: mini
ID: FUX-15
Parent: FIX-UF
Owner: dev
Depends: none
Criteria: reports/user-fix-round.md UF-3 (MED); reports/ux-1.md ux-11/12/13, reports/ux-2.md ux-14
Skills: none
Budget: files=2; actions=5; changed_lines=45; minutes=8

## Goal
Fix the remaining deferred LOWs that need markup/behaviour: (ux-11) wrap the
`.rail-search` label text in a span so the CSS ellipsis/icon-only rules can
target it; (ux-12) show `Ctrl K` instead of `⌘K` on non-Mac platforms;
(ux-13) add the missing Arabic keys for the new shell strings; (ux-14)
restore focus to `.rail-search` on EVERY palette close (⌘K toggle and
route-change currently drop focus to `document.body`).

## Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | rail-search button (L422-446), palette close/focus (L181 toggle, L235 route-change, L599-607 onClose), state/effects near L90-185
- Edit: `specs/legacy-parity/data/legacy-i18n-ar.json` | add 4 keys

## Context
- `AppShell.tsx:422-446` | `.rail-search` button: svg + `{D('Search or jump to…')}` + `<kbd>⌘K</kbd>` — label is a bare text node
- `AppShell.tsx:168-185` | global ⌘K/Ctrl+K keydown toggles `paletteOpen` — bypasses `onClose`
- `AppShell.tsx:230-236` | route-change `setPaletteOpen(false)` — bypasses `onClose`
- `AppShell.tsx:599-607` | `onClose` currently calls `railSearchRef.current?.focus()` — covers Esc/backdrop/Enter only
- `reports/ux-1.md` ux-11/12/13 + `reports/ux-2.md` ux-14 | exact fix directions

## Contract
- ux-11: wrap `{D('Search or jump to…')}` in
  `<span className="rail-search-label">…</span>` (CSS hook for FUX-14's
  ellipsis + rail-off hide rules; no other markup change).
- ux-12: the kbd label becomes platform-aware and HYDRATION-SAFE — e.g.
  `const [modKbd, setModKbd] = useState('⌘K')` + a `useEffect` that sets
  `'Ctrl K'` when `!/Mac|iPhone|iPad/.test(navigator.platform)`; render
  `<kbd>{modKbd}</kbd>`. SSR/first client render must output the same
  string (`⌘K`), then the effect swaps — no `navigator` read during render.
- ux-14: restore focus on every palette close via a falling-edge effect:
  `useEffect` on `paletteOpen` — when it transitions true->false call
  `railSearchRef.current?.focus()` (a `prevPaletteOpen` ref or equivalent).
  Simplify `onClose` to just `setPaletteOpen(false)` (the effect now owns
  restore) so all three close paths behave identically.
- ux-13: add these keys to `legacy-i18n-ar.json` (flat English->Arabic map;
  insert next to similar shell strings or append — JSON order is
  irrelevant): `"Search or jump to…"` -> `"ابحث أو انتقل إلى…"`,
  `"Search pages"` -> `"ابحث في الصفحات"`,
  `"No pages match"` -> `"لا توجد صفحات مطابقة"`,
  `"vs prior period"` -> `"مقارنة بالفترة السابقة"` (used by FUX-12's delta
  chip). Keep valid UTF-8 JSON, no trailing commas.
- Out of scope: CommandPalette.tsx internals, refresh.css (FUX-14),
  navigation/focus logic beyond the palette close paths, other i18n keys.

## Actions
1. Wrap the rail-search label in `.rail-search-label` span (ux-11).
2. Make the kbd hint platform-aware per ux-12 (hydration-safe).
3. Add the falling-edge focus-restore effect and simplify `onClose` (ux-14).
4. Add the 4 Arabic keys to `legacy-i18n-ar.json` (ux-13); validate JSON.
5. `npx eslint src/features/shared/components/shell/AppShell.tsx` + `npx tsc --noEmit` + `node -e "JSON.parse(require('fs').readFileSync('specs/legacy-parity/data/legacy-i18n-ar.json','utf8'))"` clean.

## Done when
- `.rail-search` label sits in `.rail-search-label`; kbd shows `⌘K` on Mac,
  `Ctrl K` elsewhere (effect-driven, no hydration mismatch).
- Closing the palette via Esc/backdrop/Enter, ⌘K toggle OR route change all
  return focus to `.rail-search`; `onClose` no longer duplicates the
  restore.
- The 4 keys exist in the AR dict and the file parses as JSON;
  `npx tsc --noEmit` clean, eslint 0 errors on AppShell.tsx.

## Verify
- Run: `npx eslint src/features/shared/components/shell/AppShell.tsx && npx tsc --noEmit` -> clean
- Run: `node -e "const d=require('./specs/legacy-parity/data/legacy-i18n-ar.json');for(const k of ['Search or jump to…','Search pages','No pages match','vs prior period'])if(!d[k])throw new Error('missing '+k)"` -> no output

## Handoff
Completes ux-11 (with FUX-14's CSS) and all UF-3 deferred LOWs.
Write results/FUX-15.md (<=10 lines); TL alone updates TRACKER.md.
