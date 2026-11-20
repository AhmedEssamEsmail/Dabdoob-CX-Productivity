# ux report - qa-all-bases-count - round 1 (FULL)

Verdict: FAIL
Open: 0B / 0H / 3M / 0L

States checked: empty ("No audits in this period/dates", "Only random-sample audits"), loading/error (unchanged shells), long text (rewritten explainer wraps in `cx-muted`), a11y names (chart `tipFor` -> `aria-label` verified, ui.tsx:294). Not verified: rendered responsive/contrast (copy-only diff; no class, token, or layout changes — judged from code).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-1 | MED | quality-analytics-page.tsx:138 | "Pending disputes" sub reads `Not final: these return when decided` — stale old-rule copy: disputed audits are now counted immediately and never left, so nothing "returns". Contradicts this page's own sub ("disputed included", :1305) and the scores-page explainer ("Disputed audits count immediately", scores:670). | Change to e.g. `Not final: counted already; the score can still move when decided` (keep the 'Final' else-branch). | dev |
| ux-2 | MED | quality-analytics-page.tsx:142-149 | `Counted, by basis:` line appends `${t.blankScores} with no score` — but blank-score audits are excluded (`qaScoreKnown_`), so the clause lists uncounted items under a "Counted" heading; with `a.length===0` it renders literally "Counted, by basis: 3 with no score." | Reword the tail, e.g. `${a.length ? ' · not counted: ' : 'Not counted: '}${t.blankScores} with no score` so exclusion is explicit. | dev |
| ux-3 | MED | quality-scores-page.tsx:213 | Panel retitled "Sample mix" but lists `d.others`, which still excludes the random basis (analytics.ts:1218 `QA_BASES.filter(b => b !== 'random')`). Title claims the full mix while showing only the non-random remainder — inconsistent with the analytics page's sibling strip, which now lists all bases incl. Random (analytics-page:43,144). | Either drop the `b !== 'random'` filter so the panel lists every basis present, or retitle to match content, e.g. "Beyond the random sample". | dev |

## What passed
- All "random only" claims removed across the three files; remaining `random` strings are accurate (empty-state "Only random-sample audits", `QA_BASIS_LABELS.random` chip).
- New subs/explainer/hints (analytics:354,597,1305; charts:141,280; scores:545,558,568,665-679) match the verified rule — all bases counted, disputed included, agent counted once; thresholds still correct (team score min n=10 = `QA_AGENT_MIN_N`, verdict n=16 = `QA_MIN_VERDICT_N`).
- ScoreCell correctly drops the `random only:` tooltip/`title`; no dead attrs left.
- Chart `aria-label`s updated and still truthful; heading structure, landmarks, chips, and TableScroll labels unchanged. No placeholder text; tone/number formats match siblings.
