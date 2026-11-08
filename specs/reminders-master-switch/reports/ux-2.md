# ux report - reminders-master-switch - round 2 (DELTA)

Verdict: PASS
Open: 0/0/0/1

States checked: loading, error, success, disabled, keyboard, focus (code audit; contrast/mobile/dark via shared classes, not rendered)

## Prior findings verification

| ID | Sev | Status | Evidence |
|----|-----|--------|----------|
| ux-1 | MED | FIXED | `Dm` is now `{rows, onSaved}` (admin-page.tsx:112) — internal rows copy gone; filter/map read the `rows` prop (lines 118, 139). Both save paths call `onSaved(u)`: `Pm` editor (lines 150-153) and boolean "Set to …" toggle (lines 168-170). Call site `<Dm rows={r} onSaved={a} />` (line 450) — `r` is the single source of truth, so `Rb` and `Dm` stay in sync on either save path. PLAN SC#2 satisfied. |
| ux-2 | MED | FIXED | `Rb` renders "Loading…" while `rows === null` (line 381) and the toggle is `disabled={busy || !row}` (line 385) — no enabled control on a guessed value, matching the sibling "Loading settings…" pattern (line 452). |
| ux-3 | MED | FIXED | Toggle gained `aria-label={`Turn reminders ${on ? 'off' : 'on'}`}` + `aria-pressed={on}` (lines 386-387); name is unambiguous among the page's toggles and pressed state is programmatic (4.1.2, 2.4.6). |

## New findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner |
|----|-----|----------------------------|----------|-----------|-------|
| ux-4 | LOW | admin-page.tsx:374,381,385 | If `rows` loads without a `reminders_enabled` row (shouldn't happen — CONFIG_DEFAULTS merges it), block shows "Reminders are on" (guessed `on=true`) with a permanently disabled "Turn off" and no explanation. | When `rows !== null && !row`, render e.g. "Setting not found" instead of the on/off status. | dev |

## Changed-region re-review (Dm/Rb/call sites, Web Interface Guidelines applied)

- `Dm` refactor introduces no regressions: local `i`/`r`/`o` states (search text, editing key, busy key) are view-state only and unaffected by prop-driven rows; exiting edit via `a('')` after save is preserved; per-key `disabled={o === h.key}` unchanged.
- Buttons are real `<Button type="button">`; async feedback routes to `Ti` toasts in `role="status" aria-live="polite"`; errors are toast-announced; `busy` prevents double-submit; labels use `…` consistently.
- Copy: "Master switch: stops all reminder popups, in-app alerts and reminder emails for everyone." — active voice, matches `block-text` sibling tone.

Not verified / assumptions:
- Contrast, focus-visible, target size, 320px reflow, dark mode: `Rb` reuses shared `block`/`block-title`/`block-text`/`btn btn-quiet btn-small` classes identical to sibling blocks — assumed compliant; no screenshot run (layout judgeable from code).
- No confirmation before disabling all reminders: per PLAN, one-click toggle is the spec and the action is reversible — not flagged (unchanged from round 1).
- WIG "destructive actions need confirmation" and "deep-link stateful UI" rules were considered; existing page conventions and PLAN scope take precedence — not flagged.
- Race note: rapid saves on two different boolean rows resolve last-response-wins on `r` — pre-existing `saveConfigSetting` pattern, not introduced by this fix.
