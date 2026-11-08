# ux report - reminders-master-switch - round 1 (FULL)

Verdict: FAIL
Open: 0/0/3/0

States checked: loading, error, success, disabled, keyboard, focus (code audit; contrast/mobile/dark via shared classes, not rendered)

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner |
|----|-----|----------------------------|----------|-----------|-------|
| ux-1 | MED | admin-page.tsx:113,151-155,168-175 vs :437,449 | Two sources of truth for config rows: `Dm` copies `initial` into `useState(n)` (line 113) and updates only its internal `e` on save (`t(u)`), while `Rb` reads AdminPage's `r`. Toggling `reminders_enabled` in the Settings list leaves `Rb` showing the stale state/label; saving via `Rb` (`onSaved={a}` updates `r`) leaves `Dm` stale (`useState` ignores new prop, no `key`). Violates PLAN SC#2 "block shows the current state". | Lift rows to one owner: pass `rows`/`onSaved` into `Dm` (drop its internal copy), or render `<Dm key={…}>`/derive `Dm` from `r`, and have `Dm`'s boolean toggle also call `a(updated)`. | dev |
| ux-2 | MED | admin-page.tsx:374-375,383-401 | While `rows === null` (fetch in flight) `on` defaults `true`: block renders "Reminders are on" with an enabled "Turn off" button acting on a guessed value on a global kill switch. Sibling Settings block shows "Loading settings…" (line 451); `Rb` has no loading state. Extends deferred qa-3 flash with an enabled-control hazard. | Gate the control on data: `disabled={busy \|\| !row}` and render "Loading…" (or skeleton) while `rows === null`; only show "Reminders are on/off" once the row is known. | dev |
| ux-3 | MED | admin-page.tsx:383-401 | Toggle button's accessible name is "Turn off"/"Turn on" — ambiguous among the page's many toggles (Settings list rows each have "Set to …"). Sibling boolean buttons set `aria-label={`Set ${h.key} to ${!h.value}`}` (line 164); `Rb` has none, and no `aria-pressed`/`aria-describedby` ties it to the "Reminders are on" status line (2.4.6, 4.1.2). | Add `aria-label={`Turn reminders ${on ? 'off' : 'on'}`}` (or make visible text "Turn reminders off"), and `aria-pressed={on}` or `aria-describedby` pointing at the status `<p>`. | dev |

Not verified / assumptions:
- Contrast, focus-visible, target size, 320px reflow, dark mode: `Rb` reuses shared `block`/`block-title`/`block-text`/`btn btn-quiet btn-small` classes identical to sibling blocks — assumed compliant; no screenshot run (layout judgeable from code).
- Toast `Ti` renders in `role="status" aria-live="polite"` region (Toasts.tsx:43) — save feedback is announced; the status `<p>` itself needn't be live.
- No confirmation before disabling all reminders: per PLAN, one-click toggle is the spec and the action is reversible — not flagged.
- Copy uses `…` correctly ("Saving…"); h2 under h1 hierarchy correct; `type="button"` present; `busy` disables during save; errors route to toast.
