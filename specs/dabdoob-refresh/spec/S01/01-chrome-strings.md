# S01-01: Chrome brand strings -> "Dabdoob CX" (layout, splash, registry APPS)
Kind: mini
ID: S01-01
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=3; actions=3; changed_lines=20; minutes=6

## Goal
The three always-visible brand surfaces carry "Dabdoob CX": document
metadata, the pre-paint boot splash (English + inline Arabic), and the eight
`APPS` titles that drive `document.title` per app context.

## Files
- Edit: `src/app/layout.tsx` | metadata `title`/`description` (L8-9)
- Edit: `src/features/shared/components/shell/BootSplash.tsx` | boot text (L60-66)
- Edit: `src/features/shared/components/shell/registry.ts` | `APPS` titles (L506)

## Context
- `src/features/shared/components/shell/registry.ts:15` | "do not hand-edit" banner — rebrand overrides; titles only
- `mockups/pages/02-home.html:17` | brand wording: "CX Helm" -> "Dabdoob CX", sub "Operations console"

## Contract
Replace display strings only: `CX Helm` -> `Dabdoob CX`,
`CX Productivity` -> `Dabdoob CX`. APPS values become `Dabdoob CX`,
`Dabdoob CX Quality`, `Dabdoob CX Productivity`, `Dabdoob CX Desk`,
`Dabdoob CX People`, `Dabdoob CX Operations`, `Dabdoob CX Queue`,
`Dabdoob CX FCR`. BootSplash English text: `Loading Dabdoob CX…`; the
inline Arabic script: `جارٍ تحميل Dabdoob CX…`.
Out of scope: identifiers, `server:` filenames, comments, keys; rail brand
markup (S03-02); login page (S03-04).

## Actions
1. layout.tsx: `title: "Dabdoob CX"`, description `Dabdoob CX — the CX command center`.
2. BootSplash.tsx: swap both `CX Productivity` strings (visible span + inline `__html` Arabic variant).
3. registry.ts L506: retitle all eight `APPS` entries in place.

## Done when
- `grep -n "CX Helm\|CX Productivity"` on the three files returns 0 hits.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
layout.tsx still imports css at L2-3; S02-02 appends `refresh.css` import there.
Write results/S01-01.md (<=10 lines); TL alone updates TRACKER.md.
