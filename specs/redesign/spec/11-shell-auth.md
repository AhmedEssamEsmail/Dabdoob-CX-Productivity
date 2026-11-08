# 11-shell-auth   (shard id: S11)
Owner: dev     Depends: S03,S04     Criteria: PLAN #3,#6
Skills: none

## Goal
Replace every raw control in the shared shell components and the auth pages with `ui/` primitives — the last un-codemodded area.

## Files
Edit/create ONLY: `src/features/shared/components/shell/{AppShell,BootSplash,ErrorBoundary,HashShim,NavIcon,OneOnOneAlerts,Popups,StateScreen,Toasts,ViewAs,ui}.tsx`, `src/features/shared/components/layout/SiteChrome.tsx`, `src/app/auth/login/page.tsx`, `src/app/auth/logout/page.tsx`
Read-only context: `e2e/responsive.spec.ts` (contract: `#nav` toggle by `getByRole('button',{name:'Menu'})`), `e2e/README.md`, `src/features/shared/components/ui/index.ts`, `e2e/auth.spec.ts`
Forbidden: everything else — no css changes needed (cx-kit.css + theme.css already cover shell/auth classes)

## Steps
1. `AppShell.tsx`: `.nav-toggle` (Menu/Close) → `<Button className="nav-toggle" aria-expanded aria-controls="nav">` — accessible name MUST stay 'Menu'/'Close' (responsive.spec clicks it); `.rail-collapse` → `<Button className="rail-collapse" aria-label …>`; `.state-screen` reload `<button className="btn btn-primary">` → `<Button variant="primary" className="btn">`? — class list must stay `btn btn-primary` → pass `className="btn btn-primary"` and do NOT add `cx-btn` — Button merges caller classes with `cx-btn` base; for legacy `.btn` contract cases keep raw with waiver instead: `// eslint-disable-next-line -- kept raw: legacy .btn contract`. Prefer the waiver here; same for the 'Open the Hub' `<a className="btn btn-primary">` (it's an anchor — leave; criterion only covers button/input/select/textarea).
2. `Popups.tsx`/`Toasts.tsx`/`ViewAs.tsx`/`OneOnOneAlerts.tsx`/`StateScreen.tsx`/`BootSplash.tsx`/`ErrorBoundary.tsx`: convert raw `<button>` → `<Button>` preserving classNames (`.va-open`, `.popup-*` actions, toast dismiss, `.btn` classes → waiver if legacy class contract), `<input>`/`<select>` (ViewAs picker) → `<Input>/<Select>`.
3. `auth/login/page.tsx`: `.field`+`.cx-input` inputs → `<Field>` + `<Input>` keeping `id`/`name="email"`/`type="email"`/`autoComplete`/`required`/`placeholder`/`htmlFor` EXACTLY (e2e fills `input[name="email"]`, `input[type="email"]`); submit → `<Button type="submit" variant="primary">` keeping `button[type="submit"]` + 'Sign in' label; keep `.field-error` + `role="alert"` and `.state-screen` shell. `auth/logout/page.tsx` same rules.
4. `ui.tsx`, `SiteChrome.tsx`, `HashShim.tsx`, `NavIcon.tsx`: only convert if raw controls exist there (ui.tsx has none; skip unchanged files).
5. `grep -rn "<button\|<input\|<select\|<textarea" src/features/shared src/app/auth` → 0 (or waived only).

## Done when
- No raw controls under `src/features/shared` or `src/app/auth`; every interactive element still matches the e2e contract.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/features/shared src/app/auth` -> clean; `npm run test:e2e -- auth responsive` passes.
