# ux report - home-quality-cards - round 4 (DELTA)
Verdict: PASS
Open: 0/0/0/1
States checked (delta scope): null `prevMonth` (`–`), null `monthDelta` (`–` sub-text, no pill), delta up/down/flat pill variants, dark mode contrast, long/negative values. Carried over from rounds 1-3: loading, error, mobile, keyboard, focus — unchanged (one card's content swapped, no interactive element added).

## Delta re-review (change-delta-card fix diff only)
- `git diff HEAD` confirms hunks scoped to `aggregates.ts` (+`prevMonth: prev`, no UI) and `overview-page.tsx` 2nd `.stat` card (lines 501–509); no CSS changes — reuses existing `:root .delta.up/.down/.flat` (refresh.css:219–232).
- Implementation matches `reports/change-delta-card.md` contract exactly: `stat-l` "Last month", `stat-v` last month's score with `%` (same format as sibling cards), pill `up`/`down`/`flat` keyed on `monthDelta` sign with `Ql(...)` `+n`/`−n`/`0` text, plain `–` when null. Sign polarity correct for a score (up = good = `--cx-status-ok-*`), unlike the inverted queue-page delta where higher is bad.
- Contrast measured (pill text vs pill bg, `--cx-text-xs` ~12px bold → needs 4.5:1): light up 5.08, down 5.58, flat 6.39; dark up 7.28, down 7.56, flat 5.87 — all pass 1.4.3.
- Not color-only (1.4.1): sign carried in text (`+3`/`−3`/`0`) plus hue — redundant encoding.
- JSX whitespace clean (conditional expressions, no stray text nodes); `–` fallback consistent with sibling cards; `.stat-v num` tabular numerals preserved; sentence-case label matches siblings ("Quality this month", "Open CTLs"); `role="group" aria-label="Quality"` intact.
- Web Interface Guidelines: token-only colors, no new interactive element, no ad-hoc styles.

## Findings
| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-4 | LOW | `overview-page.tsx:507` | Pill announces bare `"+3 pts"` to AT and is mildly ambiguous under a "Last month" label (up relative to what?). Sibling precedent at `:170` already adds an aria-label on a delta (`aria-label={\`${Ql(s.delta)} since the last snapshot\`}`). | Add `aria-label={\`${q.monthDelta >= 0 ? 'up' : 'down'} ${Math.abs(q.monthDelta)} points vs last month\`}` to the pill span (visual unchanged). | dev |

## Prior findings
| ID | Sev | Status |
|---|---|---|
| ux-2, ux-3 | LOW | Fixed (verified round 3); no regressions — `openCtls` null-guard and plain-language copy untouched by this diff. |

Not verified / assumptions: rendered layout (no Playwright run — pill is ~compact xs text in an existing flex `.stat-d`, overflow risk nil); contrast computed from theme.css token values, not a live browser.
