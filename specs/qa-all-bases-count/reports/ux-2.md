# ux report - qa-all-bases-count - round 2 (DELTA)

Verdict: FAIL
Open: 0B / 0H / 1M / 1L

States checked: prior open findings re-verified from code; copy consistency between the renamed panel and the scores-page explainer. Not verified: rendered layout/contrast (one-line string changes only — no class, token, or structure changes).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-4 | MED | quality-scores-page.tsx:672 | The ux-3 fix retitled the panel to "Beyond the random sample" (:213) but the explainer still says "The sample-mix panel and the 'every audit counted once' line are shown for context." — a dangling reference to a panel name that no longer exists on the page; users cannot match "sample-mix panel" to any visible heading. | Change to `The &quot;Beyond the random sample&quot; panel and the &quot;every audit counted once&quot; line are shown for context.` (or reword descriptively, e.g. `The panel of other sample bases ...`). | dev |
| ux-5 | LOW | quality-analytics-page.tsx:143-148 | When `a.length===0` the line renders "Counted, by basis: Not counted: N with no score." — explicit but awkward; the "Counted, by basis:" lead-in has an empty list. (Logged only; the ux-2 exclusion bug itself is fixed.) | Optional: when `a.length===0`, drop the "Counted, by basis:" prefix, e.g. render just `Not counted: N with no score.` | dev |

## Verified fixed (ux-1..ux-3)
- ux-1 `quality-analytics-page.tsx:138` — now `'Not final: counted already; the score can still move when decided'`; consistent with the "disputed included" sub (:1305) and the scores explainer (:670-672). PASS.
- ux-2 `quality-analytics-page.tsx:146-148` — blank-score tail now renders ` · not counted: N with no score` / `Not counted: N with no score`; exclusion is explicit, no longer listed under "Counted". PASS.
- ux-3 `quality-scores-page.tsx:213` — panel retitled "Beyond the random sample", matching its `d.others` (non-random) content; empty state "Only random-sample audits in these dates." (:227) stays accurate. PASS — but see ux-4 for the orphaned explainer reference it introduced.

## Not verified / assumptions
- Diff scope confirmed against tl-2: only the two page files changed this round, all one-line string edits; `git status` shows no new UI files since round 1.
- `d.others` still excludes `random` in analytics.ts — unchanged per fix spec (option B), acceptable.
