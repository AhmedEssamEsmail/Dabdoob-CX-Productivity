# ux report - home-quality-cards - round 3 (DELTA)
Verdict: PASS
Open: 0/0/0/0
States checked (delta scope): null-quality empty state (`–` now on all four cards), null `openCtls` vs legit `0`, plain-language copy. Carried over from rounds 1-2: loading, error, mobile, dark, keyboard, focus — unchanged (three text-node edits only).

## Prior findings
| ID | Sev | Status | Evidence |
|---|---|---|---|
| ux-2 | LOW | **Fixed** | `overview-page.tsx:511` `q.openCtls == null ? '–' : Hi(q.openCtls)` — `q` falls back to `{}` when `e.quality` is null (line 391), so the card shows `–` like its siblings instead of `0`; a real `0` still renders `0` since `0 == null` is false. Better than the originally suggested `e.quality ? …` — also covers a partial payload missing `openCtls`. |
| ux-3 | LOW | **Fixed** | `overview-page.tsx:502` "score points vs last month", `:507` "current week" — jargon ("signed change", "quota week") replaced with plain language consistent with neighbour `.stat-d` copy ("audits so far", "needing coaching"). |

## Delta re-review (changed lines 502/507/511 only)
- `git diff HEAD` confirms hunks scoped to three `.stat-d`/`.stat-v` text nodes; no markup, style, or interactive-element changes since round 2.
- Web Interface Guidelines pass on changed lines: no anti-patterns; copy is plain second-person-neutral stat annotation; `–` text fallback (not color-only); numbers keep `num` class (tabular numerals per existing convention).
- `role="group" aria-label="Quality"` intact (PLAN #5); `.page-stats--quality` spacing uses `--cx-space-5` token (hub.css:228).
- Consistency: "current week" vs label "Quality this week" is mildly redundant but matches sibling pattern ("in the oldest band" under "Open 30+"); acceptable, not logged.

Not verified / assumptions: rendered output (no Playwright run — change is text-node only); contrast/focus verdicts from round 1 stand since no color, size, or interactive change.
