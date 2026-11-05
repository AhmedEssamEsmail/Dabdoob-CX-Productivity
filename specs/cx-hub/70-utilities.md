# Shard 70 — Remaining utilities & final sweep

> Priority 8. Scope M. Depends on: all module shards.

## Contents

1. **Hidden route** `ecosystem` — ships with shard 10; verify it stays URL-only (not in registry rail).
2. **Route registry parity audit** — every legacy path resolves; unknown paths fall back with the legacy note; `#/`, `?page=`, `?tab=` shim coverage; `BUILT_ROUTES` complete (39 of 40 — `fcr` stays placeholder per D-FCR).
3. **Admin > Scheduled jobs / Health UI** — heartbeat table read UI (`hbRowState_` ok/warn/down/idle), refresh_log viewer, `connectToHub`/`setAppUrl` equivalents as read-only "Connected apps".
4. **Legacy URL compatibility** — `.gas`/script.google.com links emailed historically: document redirect guidance (server-side redirect map if any old links hit the deployment).
5. **Mail log + Options + Popups admin coverage** — confirm Admin tabs cover email log, dropdown choices editor, popups management if legacy had UI for them (Admin page inventory from hub extract).
6. **Appearance** — verify Admin > Appearance tab: theme auto/light/dark, accents pine/blue/plum/rust, reduce transparency/motion, en/ar — all present and stored `cx.appearance` only.
7. **`not connected` state** — unreachable in unified app; confirm dead-code removal or keep dormant behind `appUrls` config if D1 ever reverses.
8. **View-as sweep** — every write path refuses under View-as (RLS/service guard), banner + reload semantics per page.
9. **Fake-test replacement** — `tph.test.ts`/`productivity.test.ts` literal-assertion suites replaced by golden tests (WP-8 did prod; extend rule module-wide).
10. **Final parity sweep** — the full state matrix (roles × themes × accents × lang × viewports) on every page; update `specs/legacy-parity/02` statuses from gates.

## Gates

- Zero MISSING rows in the updated gap matrix (FCR excepted, documented).
- Every scheduled job has a heartbeat row + pg_cron/vercel schedule + run log.
