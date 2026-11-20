# ux report - home-quality-cards - round 2 (DELTA)
Verdict: PASS
Open: 0/0/0/2
States checked (delta scope): null/empty scores ('–' renders on all three score cards), unit annotation on values, signed delta formatting. Carried over from round 1: loading, error, mobile, dark, keyboard, focus — unchanged by this fix (three text spans only).

## Prior findings
| ID | Sev | Status | Evidence |
|---|---|---|---|
| ux-1 | MED | **Fixed** | `overview-page.tsx:496` `` `${q.month}%` ``, `:501` `` `${Ql(q.monthDelta)} pts` ``, `:506` `` `${q.week}%` `` — `Ql` (hub-shared.tsx:323) emits `+2.3`/`−1.2`/`0`, so delta reads `+2.3 pts`, matching scores-page `+N points` phrasing and pulse `%` (line ~418 `{ pulse.quality ?? null }` → rendered with `%` in Team pulse row). Units now unambiguous beside `87%` on same screen. |
| ux-2 | LOW | Open (deferred by TL) | `overview-page.tsx:511` still `Hi(q.openCtls ?? 0)` → renders `0` when `out.quality = null` while siblings show `–`. Fix unchanged: `e.quality ? Hi(q.openCtls ?? 0) : '–'`. |
| ux-3 | LOW | Open (deferred by TL) | `overview-page.tsx:502` `signed change`, `:507` `quota week` — jargon copy unchanged. |

## Delta re-review (changed lines 496/501/506 only)
- Git diff confirms fix hunks are scoped to the three `.stat-v` spans; no other markup/style touched since round 1.
- `'–'` (en dash) used consistently for nulls — matches pulse row `–` convention; text, not color-only.
- `pts` unit on delta is text — no a11y issue; `aria-label="Quality"` group intact (PLAN #5).
- No new interactive elements, no contrast/spacing changes — 1.4.3/1.4.11/2.5.8 verdicts from round 1 stand.

Not verified / assumptions: rendered output (no Playwright run — change is text-node only); live `monthDelta` edge cases (`Ql(0)` → `0 pts`, acceptable); ux-2/ux-3 remain logged as LOW polish per TL FIX policy deferral.
