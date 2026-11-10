# DECISION: ux-ui-audit-v2

Context: Approved scope = all findings. Largest debts: 3 coexisting class vocabularies (legacy bare / `.cx-*` / refresh utils), 4× duplicated fetch/loader plumbing, ≥6 page-shell + ~5 tab + ~6 chip impls, 282KB dead sheets. Stack: Next 16 + React 19, 98% client components, verbatim-port constraint (PORTING-GUIDE: keep legacy fn names). No deps/db/API changes.

Options:
 A) Components-mandatory — enrich all primitives, codemod ~120 raw-class call sites to components. Pros: strongest enforcement. Cons: biggest JSX churn on verbatim ports, visual-diff risk, L effort.
 B) `.cx-*` canonical, dual-form — declare `.cx-*` canonical per widget; behavioural widgets via promoted/enriched primitives (Tabs, Chip, Button, PageShell, Dialog, Empty, TableScroll, AutoSaveInput, PaintGrid, VirtualList); pure surfaces stay documented raw classes (`.cx-panel/.cx-table/.cx-note`); eslint gate on loser families only; delete zero-value wrappers. Pros: matches porter reality, ~30-40% selector cut, moderate effort. Cons: two legal forms for surfaces — mitigated by per-widget map + lint.
 C) CSS-alias truce — keep 3 families, alias losers. Pros: zero markup churn. Cons: ambiguity + load-order fragility (the Tabs break class) persist.

Decision: B — the audit's own recommendation (Top-2 fix); `.cx-*` already wins where adoption is real (Button/Input/Seg/Chip/Field); smallest diff that kills the divergence class without a big-bang component codemod.

Design / module homes:
- `shared/components/ui/` (barrel index.ts): PageShell (PwShell API: title/purpose/aside/narrow — richest impl); Tabs rewritten on tph-tabs APG impl rendering `.cx-tab`+aria-selected; Chip with `status` union 'neutral|info|ok|warn|bad' (delete StatusChip, shell/ui.tsx Chip, PwBadge, StatusPill/ScorePill/pillCls); Button +quiet/icon/danger-quiet (kills `.btn/.va-*/.nav-*/.md-reject/.dk-sm/.pw-del-btn` stacking); one Dialog on native `<dialog>` (absorbs .popup/.trk/.hm/.pw/.cx-dialog + Modal.tsx); Empty(icon,action); TableScroll (min-width+tabindex+fade); AutoSaveInput; PaintGrid; VirtualList; SettingsSection+TOC; NotConnected. Delete unused Card/Table wrappers — `.cx-panel`/`.cx-table` are the documented raw classes.
- `shared/lib/`: fetch-json.ts canonical (+FetchError, +postJson; delete copies in qa-shared/cx-queue/hub-shared); new use-page-data.ts (merges useSe×3 + useLoaded×4, keeps name-cache semantics), use-options.ts (merges 5 /api/options inflight Maps), use-search-param-state.ts, use-poll.ts, error-copy.ts.
- `shared/platform/time.ts` stays canonical for Kuwait helpers — feature copies delegate.
- Area *-shared modules stay feature-local (qa-shared, hub-shared, pv-shared, pw.tsx, dk-shared) but re-export shared plumbing; cx-people/shared.tsx re-points to shared homes — kills the people→queue import edge.

Migration order constraints:
1. Registry guard + additive CSS-contract fixes (upnext, cx-ladder, .cols-*) first — independent.
2. Foundation shards (plumbing homes + PageShell/Tabs/Chip/Button/Dialog promotions) BEFORE area migration shards — area shards consume final APIs only. Baseline before area fixes: yes.
3. Per-area codemods parallelizable by feature area; one widget family per shard.
4. Dead-CSS deletion only AFTER that area's markup migrated (same-area, later shard); eslint `no-restricted-syntax` ratchets on per-area. Unimported globals.css/legacy-apps.css delete early (independent).
5. Monolith splits + memo pass LAST, on deduped code.

Risks & mitigations: visual flips on divergent pairs → diff vs `shots/` per area, one family per shard; specificity/load-order regression → delete loser rules in same shard as codemod; useSe cache semantics → preserve name-cache in usePageData; Chip union breaks strings → typecheck catches; PORTING-GUIDE → legacy fn names survive as re-exports.

Rollback: additive-first (new modules + barrels); per-area codemods revert independently; CSS deletion last keeps old rules live during migration.

Stays out: RSC/server-initialData hoisting (PERF-H2 runner-up — client usePageData only), @layer rewrite (defer; document load order only), rebrand/dark-mode/RTL-gantt redesign (logical-prop sweep only), dependency upgrades (three.js stays — dynamic import), hash-link router rework, DB/API changes, perf-baseline rewrite (PERF-H12 runner-up — flag: current perf budget unenforced).

Impacts on PLAN: adds Phase D ordering (foundation → area → deletion → splits); flags ui/tests stay y; tests +e2e for paint-grid/Tabs keyboard; deps n; Security skip confirmed.
