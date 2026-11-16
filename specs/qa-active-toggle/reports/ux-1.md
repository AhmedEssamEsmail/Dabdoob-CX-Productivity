# ux report - qa-active-toggle - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/5L

Scope reviewed (changed UI only): `quality-analytics-page.tsx` (new `qa-active` Seg + scope wiring), `quality-scores-page.tsx` (`qs-active` Seg + `act` hash param), `qa-shared.tsx` (`P.*` signatures, `DrillSection` scope.active). Shared `Seg` (`src/features/shared/components/ui/Seg.tsx`) and `.cx-seg`/`.cx-filters` styles in `cx-kit.css` checked as the design-token source; sibling Segs (`qa-grain`, `qs-preset`, `qs-level`, `qa-basis`) used as the consistency spec. Server-side files are out of UX scope.

States checked: loading (SWR keeps stale data — no layout shift), empty (existing per-section empty states; fail-open can't blank pages), error (existing `QaPage`/`LoadError`), disabled (n/a — no disabled options), long text (Seg `flex-wrap` + `max-inline-size:100%`), mobile (wrap declared at `.cx-filters`/`.qs-bar`; 320 render not verified), dark (tokens themed in both schemes), keyboard (native radios — arrow-key group nav, one tab stop), focus (`input:focus-visible + span` 2px `--cx-focus` outline).

Measured (code-declared values): unselected label #4f5d6b on #f7f9fa ≈ **6.1:1**; selected #1d2632 on #fff ≈ 15:1; dark #9aa9b4 on #222c37 ≈ **5.9:1**, selected ≈ 12:1 — all ≥4.5:1. Focus #2f6fed on #f7f9fa ≈ **4.1:1** ≥3:1. Target height `var(--cx-target) − 2px` = 34px (44px coarse) ≥24px. Radio `name`s unique per page (`qa-active`, `qs-active`). `role="radiogroup"` + `aria-label` + implicit labels ✓. Reduced-motion global override covers `.cx-seg` transitions ✓. Toggle clears open drill on both pages (`l(null)` / `agent:''` + keyed remount) — no dead drill ✓. Scores persists `act=all` in hash; absent ⇒ active ✓.

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-1 | L | `quality-analytics-page.tsx:1271` | `onChange={(o) => r(d, a.period, a.basis, o)}` reads the stale payload — toggling Active while a period/basis refetch is in flight silently drops the pending change (race inherited from sibling handlers) | Pass committed scope: `r(d, n.period, n.basis, o)` | dev |
| ux-2 | L | `quality-analytics-page.tsx:1276`, `quality-scores-page.tsx:535` | `aria-label="Show agents"` under-describes: the filter also removes team leads and auditors; the option text says "users" | `aria-label="People to show"` (or "Include") on both | dev |
| ux-3 | L | `quality-analytics-page.tsx:1206-1221` | New `active` mode isn't URL-persisted on /quality-analytics (matches that page's no-URL convention; PLAN scoped persistence to scores) — mode isn't deep-linkable there, unlike `?act=all` on /quality-scores | Optional parity: hash param later | dev |
| ux-4 | L | `cx-kit.css:365-375` | `.cx-seg label` has no `:hover` style (only the `.qa-ctlform` variant does); both new Segs inherit the shared gap — pre-existing, app-wide | Add `label:hover { color: var(--cx-ink) }` (as `.pw-seg` does) in shared css | dev |
| ux-5 | L | `cx-kit.css:376-381` | Checked-state pill #fff vs track #f7f9fa ≈1.05:1 (dark ≈1.2:1) <3:1; mitigated by bold text + `shadow-1` so state isn't color-only — shared pattern, polish only | Optional: stronger checked outline in shared css | dev |

Web-interface-guidelines applied to changed hunks: semantic radios (not div-onClick) ✓, labels wrap inputs ✓, `aria-label` on group ✓, no `transition:all` added (existing lists properties) ✓, hover missing (ux-4), URL-state partial (ux-3), copy sentence-case ✓.

Not verified / assumptions:
- No live run: rendered layout at 320/375/1024px, focus-not-obscured (2.4.11), and the `e2e/page-contract` check remain unverified (deferred with QA's e2e; wrap/`max-inline-size` make 320px overflow unlikely).
- Scores `h()` refetches on `active` change and clears `agent`; analytics `r()` resets drill pick — both verified from code, not interaction.
- Contrast ratios computed from `theme.css` token values, not rendered pixels.
