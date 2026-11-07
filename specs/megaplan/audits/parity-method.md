# WP-45 — parity verification method

How render parity between the legacy GAS bundles and the ported pages is
established, what is compared, and how to re-run the checks.

## Decision

Option (a) — an automated DOM/class-diff harness — was chosen over a purely
documented acceptance method. The harness is cheap to re-run after any page
change and gives byte-level evidence instead of screenshots.

## How it works

`scripts/parity/run.ts` renders each high-risk page **twice** and diffs the
resulting element trees:

1. **Legacy side** (`legacy.ts`): the extracted legacy `*.closure.js` bundle is
   executed in a Node `vm` sandbox with a fake GAS host (`gas` stub wired to
   `fixtures.ts`) plus a minimal React/Preact-compatible shim that records the
   element tree instead of mounting to a DOM.
2. **Port side** (`port.ts`): the ported React component is rendered through a
   jsdom-free server-render path using the *same* fixture data via a stubbed
   `api()` client.

`diff.ts` canonicalises both trees (tag, class list, attributes, text) and
reports per-node mismatches. `fixtures.ts` supplies one shared data set per
page so both sides resolve identical values; `pages.ts` holds the page list.

## What is compared

- Element structure and ordering (tag-for-tag)
- Class names (`cls` list — the legacy `cx-*`/`dk-*`/`sch-*` conventions)
- Text content / copy
- Render errors: an identical exception on both sides indicates a *fixture*
  gap, not a port divergence (both implementations read the same missing
  field); a one-sided error indicates a real divergence.

## Current verdicts

Generated reports: `specs/megaplan/audits/parity/<page>.md` +
`parity-report.json`.

| Page | Verdict |
|---|---|
| qa-forms | MATCH |
| audit-queue | MATCH |
| scheduler | MATCH |
| tl-performance | MATCH |
| meetings | MATCH |

5/5 high-risk pages render node-identical trees from the shared fixtures.
Getting to full MATCH required completing fixture shapes that *both* sides
demand (`quotaWeeks[*].days/perDay/done/remaining`, `plan.totals/problems/
exceptions`, `timeline.conflicts`, `otd.warehouses/months`) — each was found
as an identical both-sides error, confirming the implementations have the
same data contracts.

## Re-run

```bash
npx tsx scripts/parity/run.ts                  # all pages
npx tsx scripts/parity/run.ts --page scheduler # one page
npx tsx scripts/parity/run.ts --html           # + HTML fragment diff in reports
```

Reports regenerate under `specs/megaplan/audits/parity/`. Extend
`fixtures.ts` — never special-case inside the renderers — when a new nested
field surfaces as a shared both-sides error.
