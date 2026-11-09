# ux report - ctl-strip-overflow - round 3 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/3L

States checked: wide-viewport layout (1600px), long text/overflow at 320px, mobile, dark (tokens unchanged), keyboard, focus. Not verified: live app render (fixture-based Playwright only), ultra-wide >1600px aesthetics.

Delta since ux-2: `src/app/styles/quality.css`:49 — one new rule `[data-app="quality"] .card:has(.qa-ctl) { max-inline-size:72rem }` (PLAN round-2 "Submit-a-CTL card cap"); `tests/ui/qa-strip-overflow.pw.ts` `submitCard` fixture + 1600px test (test code, not UI surface). WIG re-fetched → `reports/wig-3.md`, applied to the changed CSS.

## Delta review — quality.css:49

- **Scope precision — OK.** `.qa-ctl` exists only at ctls-page.tsx:142, inside `section.card` (:346, the Submit-a-CTL card). The aside `aside.card.card-pad.qa-ctlside` (:279) is a *descendant* of `.qa-ctl`, so `:has(.qa-ctl)` cannot match it; list/SLA cards have no `.qa-ctl` descendant. Confirmed by grep across `src/` — the rule hits exactly one card.
- **Consistency — OK.** `max-inline-size` logical property matches the file's convention (:39, :43, :50, :59, :102) and is RTL-safe; `:has()` has codebase precedent (cx-kit.css:1448 `body:has(dialog[open])`, :420 `:has(input:checked)`, queue.css:198-199); scoped under `[data-app="quality"]` per PLAN; 72rem matches the prescribed mockup cap (`mockups/ctl-compact/mock.css:52`) and the file's literal-rem convention (44rem :43, 28rem :39).
- **Layout — OK.** `.card` is block-level with no `margin-inline:auto` (refresh.css:162-165), and `[data-app="quality"]` sets `--page-max:none` (theme.css:89) so `.cxp` is full-width inline-start aligned — the capped card stays flush with the page edge, consistent with siblings. It's a max-only constraint: inert below 72rem card width, so the <64rem single-column path (media query :45-48) and 320px reflow are untouched; `max-inline-size` can only shrink, never create overflow.
- **WIG — no new violations.** `.qa-ctl` tracks are already `minmax(0,…)` and `.qa-ctlside` has `min-inline-size:0` (:51), so the 3fr/2fr split inside the 72rem cap truncates rather than overflows. No focus/keyboard/AT impact — pure geometry.
- **Rendered proof — gate-pw3.log: 3/3 pass.** New test asserts submit card ≈1152px (72rem) at 1600px, form+aside side-by-side (`asideL > formL`), `scrollWidth <= clientWidth`, and list card wider than submit card; prior 1400px/320px cases stay green.

## Prior open findings — re-verified, still present (unchanged files)

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-2 | LOW | quality.css:227,229-232; ctls-page.tsx:384-410 | `.qa-name`/`.qa-meta`/`.qa-note-txt` still ellipsize with no `title`/expansion on the `article` variant; rules confirmed unchanged at :227-232 | `title` (or sr-only full text) on the truncating spans | dev |
| ux-3 | LOW | disputes-page.tsx:166 | `.qa-chev` `<svg>` still lacks `aria-hidden`/`focusable`; confirmed at :166 | `aria-hidden="true" focusable="false"` | dev |
| ux-4 | LOW | ctls-page.tsx:332 | `scrollIntoView({behavior:'smooth'})` still bypasses `reduceMotion()` (qa-shared.tsx:1062); confirmed at :332 | `behavior: reduceMotion() ? 'auto' : 'smooth'` | dev |

Not verified / assumptions:
- ux-2/3/4 remain pre-existing/deferred per TRACKER; this round's diff does not touch their code.
- Live `/quality` render not re-verified (fixture-rendered Chromium with the real CSS cascade, same as prior rounds — flagged by tl-3).
- Minor note, not a finding: above ~72rem viewport the capped submit card is inline-start-aligned while the list card spans full width — this asymmetry is exactly what PLAN prescribes ("keep list/SLA cards full width"), matching the mockup's 72rem intent.
