# ux report — ui-shell-polish — round 1 (FULL)

Verdict: FAIL
Open: 0B / 0H / 2M / 2L

States checked: loading (login overlay live-verified; "Assigning…"; reminders loading
chip), empty (calibration "No finished calibrations yet", qs "No random audits…"),
error (login `role=alert`, reminders error+Try-again, cal `cx-error`), success
(reminders "Reminders are on" toast captured), disabled (toggle, submit), long text
(agent names wrap, `.who-name` ellipsis), mobile 375 (qs table scrolls inside
`TableScroll`, no document hscroll; reminders row wraps), dark (token-based — all new
CSS uses `--cx-*`/color-mix; not screenshot-verified), keyboard (native
link/checkbox/button; pending fires on Enter), focus (`:focus-visible` rules at
cx-kit.css:120-131, 418-421).

Browser-verified on dev server (shots in `reports/shots/`): login overlay appears on
submit, `role=status`, dismissed after nav; `.nav-link[data-pending]`+`aria-busy`
set on click, cleared post-nav; qs drill table headers/cells aligned (`qa-sub`
inline); calibration fields measured gap 12px, no overlap; reminders row = hint
left + pill right; rail-foot avatar removed, name 12px nowrap.

| ID | Sev | file:line | Evidence | Fix | Owner |
|---|---|---|---|---|---|
| ux-1 | MED | `src/app/auth/login/page.tsx:62-91` | Overlay's 15s timeout (`navWatch`) only starts **after** `fetch` resolves; a hung `/api/auth/login` leaves the full-viewport `position:fixed` blocker up forever with no cancel (the "dead seconds" defect becomes infinite). | Wrap the fetch in `AbortController` + ~20s timeout, or start a single timeout covering fetch+nav → reuse the same `catch`/`setError('Sign-in timed out…')` path. | dev |
| ux-2 | MED | `src/features/cx-hub/components/admin-page.tsx:346-363` + `Toggle.tsx` | Controlled `checked={on}` + `disabled={busy}`: on click the pill reverts to the old state and dims (opacity .55) for the whole request — looks dead (verified at 1.5s artificial latency; predecessor button showed "Saving…"; sibling Toggles at admin-page.tsx:295-300 respond instantly). | Add busy affordance: optimistic checked state, or render `Saving…`/`.is-busy` spinner in the pill while `busy`; keep `disabled`. | dev |
| ux-3 | LOW | `src/app/cx-kit.css:1572` + `src/app/theme.css:507-529` | Reduced-motion kill zeroes `animation-duration` but not `animation-delay`; `.page>*` holds `opacity:0` (backwards fill) up to i×stagger = 360ms (first load) / 144ms (calm nav) under `prefers-reduced-motion`/`data-reduce-motion`. | Add `animation-delay:0s !important` to both kill blocks in theme.css. | dev |
| ux-4 | LOW | `src/features/shared/components/shell/AppShell.tsx:629` + `src/app/cx-kit.css:1151` | `.who-name` truncates long names with `title: null` — topbar shows initials ("EA") only, so a truncated rail name is unrecoverable in-app. | `title={user.name}` on the `.who-name` element. | dev |

Verified OK (no findings): pending indicator = accent text + 2px bar (non-color
cue, `position:relative` present); `:root[data-entry="calm"]` entry vars correct
(attribute is on `documentElement`); view-transition removal complete (keyframes +
`::view-transition-*` gone); `.qa-grid>*` `min-inline-size:0` + input
`max-inline-size:100%` measured non-overlapping at 1440px and no hscroll at 375px;
reminders `#reminders` anchor + `h2` + `Ln.saveConfigSetting`/`Ti` semantics kept,
save verified end-to-end (toggle flipped, toast shown); rail-foot keeps
`topInitials` path for topbar; spinner/overlay honor reduced-motion via
refresh.css:477 + global kill; sort `aria-sort`, `role=alert`, label `htmlFor`
wiring intact; all colors via `--cx-*` tokens (dark-mode-safe).

Not verified / assumptions: dark-mode rendering not screenshot-checked (token-only
changes); `prefers-reduced-motion` delay gap (ux-3) assessed from CSS, not
emulated; console errors observed ("unstable `Date.now()` while prerendering" +
dev "1 issue" badge) are the foreign pre-existing noise noted in tl-4.
