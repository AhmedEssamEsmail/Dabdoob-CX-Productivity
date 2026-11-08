# ux report - dabdoob-refresh - round 2 (DELTA)

Verdict: FAIL — all 8 in-scope findings (ux-1..ux-8) verified RESOLVED with no
regressions in the delta; the FAIL is driven by one newly sighted **pre-existing**
defect (ux-15) on a non-delta file, surfaced while regression-checking the shared
`.mixbar` ink rule. PM may gate on it or defer to TRACKER.

Open: 0B / 0H / 1M / 1L
States checked: prior findings re-verified from code; contrast re-measured for
every new/changed token pair (age-ink ramp light+dark, accent-text light+dark).
Palette trap/ARIA/scroll verified from code. No live session (behaviour judged
from code; dev server not required).

## Prior findings — verification

| ID | Status | Evidence |
|---|---|---|
| ux-1 HIGH | RESOLVED | refresh.css:519-524 now `.login-card .cx-btn--primary` (matches `Button variant="primary"` → `cx-btn cx-btn--primary`, Button.tsx:23-24) — height 2.5rem; `svg{width:.95rem;height:.95rem;flex:none}` caps the arrow glyph. |
| ux-2 MED | RESOLVED | login/page.tsx:107-112 — dead `<a href="#">` replaced by non-interactive `<span>` (no reset route exists); accent-text inline color. Clicking the label still focuses the input — harmless. |
| ux-3 MED | RESOLVED* | CommandPalette.tsx:134-137 preventDefault on Tab/Shift-Tab — single focusable node (input) so focus cannot leave `.cpk`; Esc still exits (no 2.1.2 trap). AppShell.tsx:100,425,603-606 — `railSearchRef` on `.rail-search`, `onClose` calls `railSearchRef.current?.focus()` covering Esc/backdrop/Enter. *Residual gap → ux-14 (LOW). |
| ux-4 MED | RESOLVED | CommandPalette.tsx:111-115 — `listRef` + effect on `[active]` scrolls `.cpk-item.on` into view `block:'nearest'`; Arrow/Home/End keep the option visible in the 22rem list. |
| ux-5 MED | RESOLVED | CommandPalette.tsx:178-182 input `role="combobox"` + `aria-expanded` + `aria-controls="cpk-list"` + `aria-autocomplete="list"` + `aria-activedescendant="cpk-item-N"` (undefined when empty); options carry matching `id` (line 205), `aria-selected`, `aria-disabled`; listbox `id="cpk-list"` (line 192). Full ARIA 1.2 pattern. |
| ux-6 MED | RESOLVED | agents-page.tsx:287 — prose wall replaced by one `.card-hint` line via `D()`. |
| ux-7 MED | RESOLVED | queue-page.tsx:192 — segment ink now `var(--cx-age-ink-${ageRank(idx,d.length)})` paired with `--cx-age-*` fill (agechip precedent). Measured: light #0f1720 on #9aa5b1/#d9a94f/#dd8a2d/#d05f2a = 7.2/≈7/≈5.5/4.6:1; white on #b03a2e/#6b1f22 = 6.0/11.4:1 — all ≥4.5. Dark ramp: 5.0-5.8:1 min — all ≥4.5. `role=button` + `aria-label`/`aria-pressed` + Enter/Space unchanged. |
| ux-8 MED | RESOLVED | refresh.css:31 `.kicker` → `--cx-accent-text`; login/page.tsx:109 forgot span → `--cx-accent-text`. Token = `var(--cx-accent-hover)` so it tracks theme+accent. Dark pine #59b795 on --cx-surface #1a232b = 6.54:1 ✓ (blue/plum/rust hovers lighter still); light = accent-hover ≈6.4:1 ✓. |

## New findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-15 | MED | tph-grid-page.tsx:2066,2080,2088 (NON-delta, pre-existing) | `var(--accent)` and `var(--bad)` are **undefined tokens** — no stylesheet defines them (only `--cx-*` exist; legacy-apps.css uses `var(--accent,#2563eb)` with fallback). `background: var(--accent)`/`var(--bad)` is invalid at computed time → "Actual"/"Over cap" mixbar segments + both legend swatches render **transparent**; the `.mixbar > div` ink (white light / #08130f dark) then sits on the card surface ≈1:1 → hour labels invisible. Remaining `--line-2` segments measure 1.39:1 light (#fff on #d3dce3) / ≈2.06:1 dark (#08130f on #3b4754) — 1.4.3 fail both themes. | `var(--cx-accent)` and `var(--cx-status-bad-edge)` (or status tokens) for the fills, and set per-segment ink: `--cx-accent-ink` on accent/bad fills, `--cx-ink-2` on `--line-2` segments. | dev |
| ux-14 | LOW | AppShell.tsx:181,235 + CommandPalette onClose | Focus restore covers Esc/backdrop/Enter only. Closing via the global ⌘K/Ctrl+K toggle (line 181) or route-change close (line 235) bypasses `onClose` → focus drops to `document.body`, not `.rail-search`. | Move restore into an `useEffect` on `paletteOpen` falling edge, or call `railSearchRef.current?.focus()` in the toggle/route-change paths. | dev |

## Verified PASS (regression checks on the delta)

- **Palette focus trap**: Tab/Shift-Tab swallowed inside `.cpk`; only one focusable node; Esc + backdrop + ⌘K all exit → no 2.1.2 trap.
- **Combobox ARIA**: role/expanded/controls/autocomplete/activedescendant all consistent; option ids unique (`cpk-item-${flatIndex}`); `aria-selected` mirrors `.on`.
- **scrollIntoView** effect deps `[active]`; `block:'nearest'` can't page-scroll (body locked, list is the scroll container).
- **Mixbar ink**: queue segment colors are inline styles → beat `.mixbar > div` base; tokens `--cx-age-ink-0..6` all defined in both themes; all 13 reachable pairs ≥4.5:1.
- **accent-text in dark**: `.kicker`, `.rowlink`, `.pill.acc`, `.avatar`, forgot span — all sit on surfaces; dark accent-text ≥6.5:1, light ≥6.4:1 measured.
- **Login CTA**: 40px height, svg .95rem — matches mock; `disabled={loading}` + "Signing in…" intact; error `role=alert` intact.
- **ts/eslint/vitest**: tl-4 integration checkpoint green (tsc clean, eslint 0, 1117/1117).

## Not verified / assumptions

- No live keyboard walkthrough (code-verified only); ⌘K-close focus drop (ux-14) inferred from AppShell code path.
- `scrollIntoView` fires only when `active` changes: mouse-wheel the list then type (active stays 0) can leave the `.on` item scrolled off — cosmetic edge, not filed.
- ux-15 rated MED for consistency with ux-7's precedent (secondary viz, AA fail) though the invisible transparent segments are arguably worse; PM decides gate vs TRACKER.
- ux-9..ux-13 remain deferred LOWs in TRACKER (out of scope this round per task).
- tph-grid-page.tsx was not in the tl-4 delta; ux-15 is pre-existing, not a fix regression.
