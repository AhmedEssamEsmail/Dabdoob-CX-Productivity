# Visual / Structural Parity Audit — CX-Hub Next.js port vs legacy GAS bundles

**Date:** 2026-11-06 · **Auditor:** automated parity subagent (audit-only, no src edits)
**Method:** `npm run dev` on :3001 → Playwright (Chromium 1440×900, full-page PNG per route) → DOM extraction → static class-token + copy-string diff of each ported component vs `.devin/work/extract/<app>/pages/<page>.js` (+ `.closure.js` for shared-dep vocabulary).
**Artifacts:** screenshots in `.devin/work/parity/<app>--<page>.png`, capture metadata in `.devin/work/parity/_shots.json`.

## ⚠ Coverage confidence — read first

Two environment-level facts constrain what could be verified live:

1. **Every page requires a Supabase session.** `src/proxy.ts` 307-redirects all unauthenticated page loads to `/auth/login`. A real admin session was minted for `shot.harness@dabdoob.com` (existing roster admin) via the Supabase Admin `generate_link` API + injected as the `sb-*-auth-token` cookie — the proxy then passes.
2. **No page can render real data for anyone right now.** `db()` uses the **anon key** (`src/features/shared/platform/repo.ts:23`), and RLS on `roster`/`config` (and presumably the rest) returns `[]` for anon *and* authenticated reads — verified directly against PostgREST. Consequences:
   - `GET /api/bootstrap` → `user.role = 'unknown'` → AppShell renders **"You are not set up yet"** for every real session (first screenshot pass confirmed this on all 40 routes).
   - All per-page APIs (`/api/hub/*`, `/api/queue/*`, `/api/people/*`, …) fail `requireRole` → **403/500** → pages render `LoadError` states.
   - To capture real page structure, `/api/bootstrap` was route-fulfilled with an admin bootstrap (StrictMode double-mount consumes a one-shot `__CC_BOOT__`, so interception was required). Page *data* calls were **not** faked — they still 403/500.

So: **rail nav, page heads, section scaffolds, skeleton/error states were verified live**; **inner content was verified structurally** by diffing the class-name vocabulary and copy strings of the TSX source against the legacy page slices. Screenshots show the shell + head + load-error (or skeleton) state, which is the only renderable state today.

> **Moving target notice:** the other agent edited `src/` during the audit. `heatmap-page.tsx` was replaced (73-line stub → ~1100-line full port) mid-run; results below reflect the *current* tree, and heatmap was re-shot after the swap. `checkins-page.tsx`, `shared.tsx`, and 6 `cx-quality` components also changed during the run.

## Verdict summary

| Verdict | Count | Pages |
|---|---|---|
| match | 25 | overview, people-holidays, admin, audit-queue, my-audits, ctls, disputes, calibration, kb-gaps, my-auditor-kpis, qa-forms, quality-scores, status-validation, my-status, productivity-analytics, tph, one-on-ones, tl-tasks, meetings, my-actions, notes, coaching, trackers, tl-performance, kb-tracker, kpi-logs, mail-desk (27 — see table; several carry minor notes) |
| minor | 5 | queue, analytics, scheduler, agents, quality-analytics |
| broken | 2 | aging, checkins |
| unverifiable | 2 | my-day (owner gate), ecosystem (3D scene needs data) |
| placeholder (correct) | 4 | hard-cases, kpi-close, escalation-matrix, fcr |
| extra routes | 4 | ecosystem*, tph-grid, admin/config, admin/roster, `/` |

## Per-page table

Legend for "Legacy classes": ✅ = all page-slice class tokens present; small lists = tokens absent from port (page-level | closure-level). `aria-*`/`data-*` attribute-name parity was separately verified — it is essentially complete (only `data-zero` on aging, appearance attrs on admin, scattered `data-reduce-motion`/`aria-live` in closures are missing).

| PAGE | SCREENSHOT | LEGACY CLASSES FOUND | MISSING / MISMATCHED | VERDICT |
|---|---|---|---|---|
| hub / my-day | `hub--my-day.png` | md-* present; head renders | Page renders owner gate: "My day is a personal assistant for mohamed.nabil@dabdoob.com only" (`src/features/cx-hub/lib/myday.ts:56`) — string is server-side, absent from legacy client slice; real content unverifiable | **unverifiable** |
| hub / overview | `hub--overview.png` | ✅ all 14 page tokens | API 403 → LoadError state only. Legacy `e.ecosystem` link card present in source | match |
| hub / people-holidays | `hub--people-holidays.png` | ✅ all 29 page tokens | API 403 → table body empty; hint copy present in source | match |
| hub / admin | `hub--admin.png` | ✅ all 4 page tokens; "Not built yet." + Dropdown choices/Connected apps = verbatim `Pf` shell (legacy admin.js was the same pending shell) | appearance dep attrs `data-accent`, `data-reduce-transparency`, `data-theme` missing in closure deps | match |
| hub / ecosystem | `x--ecosystem.png` | eco3-* renders | `/api/hub/ecosystem` 403 → error panel only; the three.js scene can't be exercised | **unverifiable** |
| quality / quality-scores | `quality--quality-scores.png` | ✅ page tokens | `re-scored` chip (closure) absent | match |
| quality / audit-queue | `quality--audit-queue.png` | ✅ all page tokens; data-answer/fatal/repeat/skipped/status/up/down attrs all present | — | match |
| quality / my-audits | `quality--my-audits.png` *(agent boot)* | ✅ | admin boot correctly redirects agent-only page → re-shot with `shot.agent` boot, renders "My audits" | match |
| quality / ctls | `quality--ctls.png` | ✅ | `re-logs` chip (closure) absent | match |
| quality / disputes | `quality--disputes.png` | ✅ | — | match |
| quality / calibration | `quality--calibration.png` | ✅ | `text-anchor` (svg attr) absent | match |
| quality / kb-gaps | `quality--kb-gaps.png` | ✅ | — | match |
| quality / my-auditor-kpis | `quality--my-auditor-kpis.png` | ✅ | — | match |
| quality / quality-analytics | `quality--quality-analytics.png` | ✅ | `re-score`, `re-scored` chips + `data-noq` absent | **minor** |
| quality / qa-forms | `quality--qa-forms.png` | ✅ | — | match |
| productivity / status-validation | `productivity--status-validation.png` | ✅ | — | match |
| productivity / my-status | `productivity--my-status.png` *(agent boot)* | ✅ | agent-only redirect same as my-audits; re-shot OK | match |
| productivity / productivity-analytics | `productivity--productivity-analytics.png` | ✅ | — | match |
| productivity / tph | `productivity--tph.png` | ✅ all page tokens | `hour-channels`, `un-clipped` (closure) absent | match |
| queue / queue | `queue--queue.png` | ✅ page tokens | Board restructured vs legacy `Ua`: no "Queues now" (`board-h`) section head, no `dq-stats`/`dq-totals` row, no `dq-agebar` panel, no `dq-groupbreak`/`dq-rowhead`/`dq-statusline` rows, no `pw-seg` metric pick or `cx-filter`; new `dq-tiles`/`dq-tile`/`qb-h` have **zero CSS rules**; "Since" column moved from position 3 to last | **minor** |
| queue / aging | `queue--aging.png` | crash | **Render crash on every mount** — invalid hook call (`aging-page.tsx:51` `useState(useHashParams)` invokes `useMemo` inside the `useState` initializer); ErrorBoundary shows "This page hit an error… Should have a queue". Also missing `cx-agegrid`, `cx-total`, `data-zero`, `notification-only`; copy trimmed ("Colour goes from grey to deep red…" sentence dropped) | **broken** |
| queue / checkins | `queue--checkins.png` | crash | **Same crash** (`checkins-page.tsx:24` identical `useState(useHashParams)` pattern). Also missing `pop-up`, `cx-dayrail` classes | **broken** |
| queue / analytics | `queue--analytics.png` | ✅ | `notification-only`, `dq-chartwrap`, `dq-crumb`, `cc-sweep-col` absent | **minor** |
| queue / heatmap | `queue--heatmap.png` | ✅ all page + near-all closure tokens; 29 hm-* live in DOM incl. "Download example file"/"Upload heatmap"/Countries/Assumptions sections | 4 closure tokens absent (trivial). Note: was a 73-line stub at audit start; replaced by full port mid-run — screenshot reflects the new version | match |
| queue / scheduler | `queue--scheduler.png` | ✅ page-chrome tokens (sch-page/head/tabs/cell/daybar…) | Tab internals simplified to generic `cx-table`: missing `sch-grid`, `sch-grid-table`, `sch-cell-td`, `sch-bar`, `sch-axis`, `sch-cov*` coverage chips, `sch-edit`/`sch-edit-row`/`sch-paste` editing, `sch-warn*` tooltips, `sch-legend`/`sch-swatch`, `sch-sticky`/`sch-scroll`, `dq-rank`/`rank-h`, `dq-crumb`, `hour-by-hour`, `pre-line`, `cx-sr`; Settings tab = text stub ("saved through the API"); `fresh` reload loses the "Re-read every input…" toast | **minor** (feature-subset rewrite) |
| people / agents | `people--agents.png` | ✅ | `day-by-day` token absent | **minor** |
| people / one-on-ones | `people--one-on-ones.png` | ✅ | `pop-up`, `check-in` closure classes absent; all data-band/dir/kind/mine/over/tone attrs present | match |
| people / tl-tasks | `people--tl-tasks.png` | ✅ | — | match |
| people / meetings | `people--meetings.png` | ✅ | — | match |
| people / my-actions | `people--my-actions.png` | ✅ | — | match |
| people / notes | `people--notes.png` | ✅ | — | match |
| people / coaching | `people--coaching.png` | ✅ | — | match |
| people / hard-cases | `people--hard-cases.png` | UnbuiltPage = legacy `hs()` | registry placeholder — correct | placeholder ✓ |
| people / kpi-close | `people--kpi-close.png` | UnbuiltPage | registry placeholder — correct | placeholder ✓ |
| operations / trackers | `operations--trackers.png` | ✅ all trk-* | — | match |
| operations / escalation-matrix | `operations--escalation-matrix.png` | UnbuiltPage | registry placeholder — correct | placeholder ✓ |
| desk / tl-performance | `desk--tl-performance.png` | ✅ | closure dep tokens `action-plan`, `operational-loss`, `queue-hour` absent (tracker-kind vocab) | match |
| desk / kb-tracker | `desk--kb-tracker.png` | ✅ | — | match |
| desk / kpi-logs | `desk--kpi-logs.png` | ✅ | — | match |
| desk / mail-desk | `desk--mail-desk.png` | ✅ | — | match |
| fcr / fcr | `fcr--fcr.png` | UnbuiltPage | registry placeholder — correct | placeholder ✓ |
| extra: `/` | `x--root.png` | renders my-day fallback → owner gate | — | — |
| extra: `/tph-grid` | `x--tph-grid.png` | identical to /tph (tph/page.tsx re-exports it) | — | match |
| extra: `/admin/config` | `x--admin_config.png` | cx-* generic page (not a registry page) | "Configuration / System Configuration" — no legacy counterpart | n/a |
| extra: `/admin/roster` | `x--admin_roster.png` | cx-* generic page | "Roster / Users" — no legacy counterpart | n/a |

## Top discrepancies (ranked)

1. **[P0 — runtime] `aging` and `checkins` crash on mount.** `src/features/cx-queue/components/aging-page.tsx:51` and `src/features/cx-queue/components/checkins-page.tsx:24` both do `const [params] = useState(useHashParams)` — `useState` invokes `useHashParams` as its lazy initializer, and `useHashParams` calls `useMemo` → React throws "Do not call Hooks inside useEffect/useMemo/other built-in Hooks" on every render. The ErrorBoundary swallows it ("This page hit an error… Should have a queue"). Fix: call `const params = useHashParams()` directly (or `useState(() => new URLSearchParams(...))` without hooks inside).
2. **[P0 — platform] Nothing can render data.** RLS returns `[]` for anon-key and user-JWT reads on `roster`/`config`; `db()` (`repo.ts:23`) only ever uses the anon key. `/api/bootstrap` → `role: 'unknown'` → "You are not set up yet" for every session; every page API → 403/500. Until RLS policies (or a service-role `db()`) land, no visual verification of populated pages is possible — this audit's inner-content verdicts are source-level.
3. **[P1] `queue` health board diverges from legacy `Ua` structure.** Missing: the "Queues now" section (`board-h`), `dq-stats`/`dq-totals` totals row, `dq-agebar` age panel, `dq-groupbreak`/`dq-rowhead`/`dq-statusline` row markup, `pw-seg` metric picker with `queues-h` scroll-to, `cx-filter` component. New `dq-tile`/`dq-tiles`/`qb-h` classes have **no CSS rules** in `globals.css`/`legacy-apps.css` → tiles render unstyled. "Since" column relocated to last position (`queue-page.tsx:70-127`).
4. **[P1] `scheduler` is a feature-subset rewrite.** Month/timeline/off/requests tabs render as generic `cx-table` instead of legacy `sch-grid-table`/`sch-cell-td`/`sch-bar`/`sch-axis` widgets; coverage chips (`sch-cov-ok/one/zero/none`), edit rows (`sch-edit`, `sch-edit-row`, `sch-paste`), warn tooltips (`sch-warn*`), legend (`sch-legend`, `sch-swatch`), sticky/scroll grid chrome, `dq-rank`/`rank-h` and `dq-crumb` all absent; Settings tab is a text stub; the `fresh`-reload "Re-read every input…" toast is dropped (`scheduler-page.tsx:23-27` vs legacy `g()` which surfaces `w.regen`/`y.fresh` messages).
5. **[P2] Copy/structure trims on otherwise-faithful pages.** `aging` drops "Colour goes from grey to deep red as the wait grows, and the stripe on each row gets thicker" + "(they come from the daily report)" (`aging-page.tsx:109`); `quality-analytics`/`quality-scores`/`ctls` lack `re-score(d)`/`re-logs` chips; `queue` exclusion hint reworded; `admin`'s appearance section lacks `data-accent`/`data-theme`/`data-reduce-transparency` hooks.
6. **[P3 — cosmetic] Port-internal classes with no CSS.** `dq-tile(s)`, `qb-h`, `check-in`, `hm-in`, `hm-set`, `load-error` are emitted but unstyled; harmless where structural, but `dq-tiles` is the queue board's primary control.

## What rendered vs not (coverage map)

- **Rendered fully (chrome + page head + error/skeleton state):** all 36 built registry pages + 4 extra routes.
- **Rendered but crashing:** aging, checkins (hooks bug).
- **Rendered as placeholder (correct):** hard-cases, kpi-close, escalation-matrix, fcr.
- **Rendered as owner-gate:** my-day.
- **Rendered as API-error panel:** ecosystem (three.js scene not exercisable).
- **Rendered nothing (redirect to fallback page):** my-audits, my-status under admin boot — correct role gating; re-shot under `shot.agent` agent boot where they render their heads + LoadError.

## Method notes for reproduction

- Sessions minted read-only via `POST {SUPABASE}/auth/v1/admin/generate_link` (`magiclink`) → `POST /auth/v1/verify` (`token_hash`) → session JSON → `sb-<ref>-auth-token` cookie (base64url `base64-` prefix, 3180-char chunking per `@supabase/ssr`).
- `/api/bootstrap` fulfilled by Playwright route interception with an admin (and, for two agent-only pages, an agent) bootstrap — required because React StrictMode dev double-mounts `loadBootstrap`, consuming a one-shot `__CC_BOOT__` on the first pass.
- Class diff: all string-literal tokens matching CSS-class shapes extracted from legacy `pages/<page>.js` and `pages/<page>.closure.js` vs the ported `*-page.tsx` + module `shared.tsx` + `shell/ui.tsx` + `StateScreen.tsx`; `aria-*`/`data-*` attribute names compared as raw JSX/prop identifiers. Registry-path tokens inside closures (embedded page registry) excluded as false positives.
- Copy diff: legacy page-slice string literals ≥14 chars, checked against the port with a 5-word sliding window after entity/`&apos;` normalization; code fragments filtered.
