# Spec index: ui-label-size-sweep
Kind: index
Size gate: PASS

Phase-2 AUTO-FIX scope (FINDINGS A/B/C) shipped via S01-S03 (all done,
see TRACKER). RESHARD/extend: DECISIONS.md (all 27 PROPOSE findings +
ux-1 approved verbatim, 2026-11-20) adds S04-S06 — implement pinned
outcomes exactly, no re-deciding. Before every edit run
`git diff HEAD -- <file>`; foreign hunks -> stop, record
`deferred-foreign` in results/<leaf-id>.md. Verbatim-legacy port: keep
`/* legacy */` headers and minified names; no refactors. All CSS writes
are append/insert-only and each shared CSS file has exactly ONE writer
leaf, so every new leaf is file-disjoint.

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | FINDINGS A1-A6 (cx-quality compact controls) — DONE | not dispatchable |
| S02 | package | S02.md | - | none | FINDINGS B1-B7 (12 textarea `rows`) — DONE | not dispatchable |
| S03 | package | S03.md | - | none | FINDINGS C1-C4 (short-input width caps) — DONE | not dispatchable |
| S04 | package | S04.md | - | none | DECISIONS Labels: 5 class-L label fixes | not dispatchable |
| S05 | package | S05.md | - | none | DECISIONS CTA `size="sm"` convention: 12 files | not dispatchable |
| S06 | package | S06.md | - | none | DECISIONS Pair fixes (7) + ux-1 fold-in | not dispatchable |

Ready work: all 24 new leaves are file-disjoint and may start at once
(max 4 workers). Leaf ids: S04-01..S04-05, S05-01..S05-12,
S06-01..S06-07.
Size gate evidence: semantic review vs LIMITS.md — largest leaf S05-02
(1 file / 9 actions / ~8 lines / 10 min); all others smaller. PM runs
`check_shards.py` on leaf refs before dispatch.
