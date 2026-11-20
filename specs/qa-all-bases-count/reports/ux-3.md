# ux report - qa-all-bases-count - round 3 (DELTA)

Verdict: PASS
Open: 0B / 0H / 0M / 1L

States checked: prior open findings re-verified from code; cross-reference accuracy between the explainer copy and on-page labels. Not verified: rendered layout/contrast/keyboard (one-line string change only — no class, token, or structure changes this round).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-5 | LOW | quality-analytics-page.tsx:143-148 | When `a.length===0` the line renders "Counted, by basis: Not counted: N with no score." — the "Counted, by basis:" lead-in precedes an empty list. Deferred in tl-3 per FIX rules; logged for a future polish shard. | Optional: when `a.length===0`, drop the "Counted, by basis:" prefix and render just `Not counted: N with no score.` | dev |

## Verified fixed (ux-4)
- ux-4 `quality-scores-page.tsx:672-673` — explainer now reads `The "Beyond the random sample" panel and the "every audit counted once" line are shown for context.` Both references resolve to visible on-page elements: panel title `Beyond the random sample` at :213 and the `Every audit counted once:` figure at :568. The dangling "sample-mix panel" reference is gone. PASS.

## Not verified / assumptions
- Delta scope confirmed against tl-3: only `quality-scores-page.tsx` changed this round, a single copy line; `git status` shows no new UI files. Files modified in earlier rounds (analytics page, charts) were reviewed in ux-1/ux-2 and untouched since.
- Copy is plain text inside an existing `cx-muted` paragraph — no new semantics, targets, or color introduced; WCAG posture unchanged.
