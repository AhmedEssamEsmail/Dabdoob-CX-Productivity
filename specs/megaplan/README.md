# CX-Hub Megaplan — Legacy Parity Review + Sharded Execution

> One-sentence summary: verify — to function-level evidence — that CX-Hub reproduces every page, API, job, table, integration and platform aspect of the 8 deprecated Google Apps Script apps, and drive the remaining work to completion via fine-grained work-packages executed by parallel sub-agents.

Status: **Review written 2026-11-06. Waves not yet executed.**

## Sources of truth

| Doc | Role |
|---|---|
| `00-gap-review.md` | The detailed review. Per-module and cross-cutting matrices with file:line evidence; every residual gap mapped to a work-package. |
| `TASK_TRACKER.md` | **The** execution tracker. One row per WP; sub-agents update their own row. |
| `w0-foundations.md` … `w5-blocked.md` | Wave briefs — the self-contained task spec a sub-agent executes. |
| `audits/` | Output dir: each wave-1 audit WP writes `audits/<module>.md` here. |
| `../cx-hub/PORTING-GUIDE.md` | Binding rules for any code change (verbatim port, forbidden files, gates). |
| `../cx-hub/TRACKER.md`, `../legacy-parity/` | Prior programme docs; kept as reference, superseded by this tracker for new work. |

## Status vocabulary

`pending → claimed → in-progress → done | blocked | deferred | verified`

- `done` = code complete, gates green, committed. `verified` = orchestrator reviewed.
- `blocked` = needs a credential/manual action — the Blocked register in `TASK_TRACKER.md` says exactly what.
- Function status in `00-gap-review.md`: `OK` ported · `PORTED-AS` ported under a different name (mapping documented) · `GATED` deferred behind a credential (points to a blocked WP) · `DIAG` admin/setup diagnostic — audit decides port vs documented-skip · `MISS` genuine gap.

## Sub-agent claim protocol

1. Orchestrator (or you) reads `TASK_TRACKER.md`; take the next `pending` WP whose `depends` rows are `done`/`verified`.
2. Set `claimed-by` to your agent name and status `in-progress` — one WP per agent at a time.
3. Read your wave brief (`wN-*.md`) end-to-end, then `../cx-hub/PORTING-GUIDE.md`. Do not edit forbidden files.
4. Implement to the brief's done-criteria. Run gates: `npx tsc --noEmit`, `npx vitest run`, `npx eslint .` (0 errors), plus the WP's specific gates.
5. Update your tracker row: status `done`, evidence (commit hash / test counts / files), any new issues → append a note, don't edit others' rows.
6. Blockers that need owner action → append a row to the Blocked register and set your WP `blocked`, not `done`.

## Hard rules for all WPs

- Legacy GAS source is the spec. **Parity, not improvement.** A visible or behavioural difference is a defect; unbuilt-in-legacy gets the honest `hs()` "Not built yet." placeholder, never an invented page.
- Each WP commits separately (per `IMPLEMENTATION_TRACKER.md` rule). No force-pushes.
- No new dependencies without owner approval (`package.json` is a forbidden file).
- Keep legacy function names verbatim incl. trailing underscores; async only at the I/O edge.
- `AGENTS.md` rule: this Next.js 16 version differs from training data — read `node_modules/next/dist/docs/` before writing page/route code.
- No secrets in code/commits. `.env*` files are forbidden.

## Wave map

```
W0 foundations (sequential)  ->  gates green
W1 module audits (9 WPs, parallel)  ->  audits/*.md + fix diffs
W2 tests & jobs (6 WPs, parallel)   ->  golden coverage + scheduling SQL
W3 migration & vendors (6 WPs)      ->  pipeline code + probes (data run partially blocked)
W4 platform sweep (6 WPs, parallel) ->  admin/view-as/routing/appearance parity
W5 blocked gates (5 WPs)            ->  execute only when owner unblocks
```

Dependencies: `W0 → all`. W1 audits may append fix-WPs to the tracker. W3/W5 partially credentialed — code-complete allowed, data-run rows stay `blocked` until creds land.
