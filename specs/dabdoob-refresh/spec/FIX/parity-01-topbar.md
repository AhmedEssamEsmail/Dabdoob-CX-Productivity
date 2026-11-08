# PX-01: shell `.topbar` on every shell page — crumbs + bell + appearance + avatar
Kind: mini
ID: PX-01
Parent: FIX-PARITY
Owner: dev
Depends: none
Criteria: reports/ux-parity.md B1 (BLOCKER)
Skills: none
Budget: files=3; actions=7; changed_lines=230; minutes=10

## Goal
Every shell mockup (02–10) carries a `.topbar` row: left `.crumbs`
(`Group / <b>Page</b>`; overview shows just `<b>Home</b>`), right
`.topbar-right` (notification bell `.icon-btn` with `.dot` when popups are
pending, appearance `.icon-btn`, `.avatar` with user initials). The CSS
exists (`refresh.css:9-15` `.topbar`/`.crumbs`/`.topbar-right`,
`.avatar`, `.icon-btn`, `.dot`) but no component renders the row.
Create `Topbar.tsx` next to `CommandPalette.tsx`, render it as the first
child of `<main id="main">`, and wire the bell to the existing `Popups`
system (re-open the reminder dialog) — not a new mechanism.

## Files
- Create: `src/features/shared/components/shell/Topbar.tsx` | new 'use client' topbar component (crumbs + bell + appearance + avatar)
- Edit: `src/features/shared/components/shell/AppShell.tsx` | render `<Topbar>` first inside `<main id="main">` (~L600), pass `current`/group label + user + bell handlers; add `reopenTick` + `pendingN` state; keep every existing id/class
- Edit: `src/features/shared/components/shell/Popups.tsx` | accept `reopenTick?: number` + `onPendingChange?: (n:number)=>void`; effect on `reopenTick` clears `dismissed`; effect reports `remaining` via `onPendingChange`; no visual change otherwise

## Context
- `mockups/pages/02-home.html` + `mockups/assets/mock.css` | exact
  `.topbar` anatomy (crumb `<b>` = current page)
- `src/features/shared/components/shell/registry.ts:497` | `GROUP_LABELS`
  already equals mock group names ("Hub", "Queue & Workforce", …)
- `AppShell.tsx:371,600-632` | `current` (PAGES entry), `<main>` block,
  `<Popups popups={boot.popups} />`; `user`/`viewAsTarget` in scope
- `src/features/shared/shell/i18n.ts:32-58` | `readAppearance`/`applyAppearance`
  + `APPEARANCE_KEY` — cycle `auto→light→dark` (read, cycle, apply,
  persist via the same storage key the admin page uses)
- `Popups.tsx:67-80` | `dismissed` set drives `current`/`remaining`

## Contract
- Topbar renders ONLY inside the shell `<main>` — never on login/
  state-screens (they return before the main render already).
- Crumb: `current.path==='overview'` → `<b>{D(title)}</b>` only; else
  `{D(GROUP_LABELS[current.group])} / <b>{D(current.title)}</b>`
  (registry `appTitle` is the EN page name; use `current.title` for the
  page label — same source the rail/tooltips use).
- Bell `.icon-btn` `aria-label` = 'Notifications'; `.dot` shown iff
  `pendingN>0`; click → `setReopenTick(t=>t+1)`; `aria-live` polite count
  not required.
- Appearance `.icon-btn` `aria-label`='Appearance'; cycles theme
  auto→light→dark→auto through `readAppearance`+`applyAppearance`
  (title/aria-label reflects current theme).
- `.avatar` = initials from `viewAsTarget?.name ?? user.name` (first
  letters of first two words, uppercase; fallback = email[0]).
- No new deps, no `<a>`/routing changes, keep `id="main"`, `aside`,
  rail, ViewAsBanner, Popups, CommandPalette ids/hooks untouched.
- SSR/hydration-safe: appearance read in an effect/click only (theme attr
  already applied by existing bootstrap); initials are deterministic.

## Actions
1. Create `Topbar.tsx` ('use client', props `{crumbGroup, crumbTitle, initials, pending, onBell, theme}`; pure render, svgs inline like the rail's icons).
2. In `Popups.tsx` add the two optional props + the two effects (reopen clears `dismissed`; `useEffect` calls `onPendingChange?.(remaining)` on change).
3. In `AppShell.tsx` add `const [reopenTick,setReopenTick]=useState(0)` + `const [pendingN,setPendingN]=useState(boot.popups.length)`.
4. Render `<Topbar>` as first child of `<main id="main">` with crumbs from `current` and the three right-slot handlers.
5. Pass `reopenTick={reopenTick}` + `onPendingChange={setPendingN}` to `<Popups>`.
6. Wire bell click → `setReopenTick`; appearance click → cycle+persist.
7. `npx eslint` the 3 files + `npx tsc --noEmit` clean.

## Done when
- Every shell page (02–10 routes) SSRs `.topbar` inside `#main` with
  correct `Group / Page` crumbs (overview: `<b>` only) and the three
  right controls.
- Dismissing all popups clears the `.dot`; clicking the bell re-opens
  the reminder dialog when pending items exist.
- Appearance button cycles theme (html `data-theme` changes) and
  persists across reload.
- `npx tsc --noEmit` clean; no removed ids/e2e hooks.

## Verify
- Run: `npx eslint src/features/shared/components/shell/Topbar.tsx src/features/shared/components/shell/AppShell.tsx src/features/shared/components/shell/Popups.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "topbar" src/features/shared/components/shell/*.tsx` -> Topbar.tsx + AppShell render line

## Handoff
Bell behaviour is verified structurally (popups list often empty on dev);
note in results whether any live popup was visible.
Write results/PX-01.md (<=10 lines); TL alone updates TRACKER.md.
