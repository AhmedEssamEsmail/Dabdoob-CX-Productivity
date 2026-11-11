# lint-unused-vars L1 — status: done

Fixed 7 no-unused-vars warnings (fresh lint count; shard said 11 — stale).
- e2e/nav-collapse.spec.ts:103 — dropped unused `nav` binding, kept `await bootedNav(page)`.
- scripts/legacy/legacy-extract.mjs — removed unused `code` param from `topLevel`/`depsOf` + 3 call sites.
- specs/ux-ui-audit-v2/probe-verify-extra.mjs — removed `mkdirSync` import and unused `btns` in page.evaluate.
- src/app/api/integrations/{freshdesk,gmail}/route.ts — removed unused `supabase` import.
- src/app/auth/login/page.tsx — untouched: it has no unused-vars warnings; only its no-img warning remains (per shard, not fixed).

Check: `npx eslint` on all 6 files → 0 no-unused-vars warnings (1 no-img warning preserved).
No git ops; no eslint-disable comments added.
