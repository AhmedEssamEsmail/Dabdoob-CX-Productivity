# TL report — Phase-2 fix round (P2F)

Date: 2025-11-11. Branch: feat/cx-hub-ui-redesign. Spec: spec/fix-P2-1.md (18 leaves).

## Triage

- ALREADY-FIXED / false-positive: Gmail `cx-link` on /mail-desk + /tl-performance; productivity TableScroll; status-validation interval `title`; `hr` inline margins; dev-overlay "N issues" badge.
- EXTERNAL/ENV (deferred): /ctls `fetch failed` + error-layout band; raw `TypeError: fetch failed` copy; `GOOGLE_*` env copy on /my-day. Evidence in TRACKER deferred row.
- NEEDS-FIX → all 18 leaves dispatched, all DONE.

## Gates (integration)

- `npx tsc --noEmit` — clean (exit 0) after all waves.
- `npx eslint` on all 14 touched source files — 0 problems.
- Browser-verified by owner: P2FQUEUE-02 (scrollWidth==innerWidth @375/768/1024), P2FPROD-01 (/tph-grid→/tph title 10/10), P2FAPP-01 (single `<main>` live).
- Browser re-check deferred to auditor (auth-gated, owner envs had no session): SH-01..06, OPS-01, QUEUE-01, HUB-01..04, QA-01/02, APP-02.

## Waves

- W1: P2FSH-01 ('use client' on StateScreen), P2FSH-02 (assets excluded from auth matcher), P2FSH-03 (crumbTitle render), P2FOPS-01 (trackers empty state + create).
- W2: P2FSH-04 (va-title h2→p), P2FSH-05 (rail-search title), P2FSH-06 (mobile shell rows), P2FQUEUE-01 (aging-page-head + generic status row).
- W3: P2FHUB-01 (kv-row stack + setting-value clamp), P2FQA-01 (min-inline-size on qa-cols), P2FAPP-01 (nested main→div), P2FAPP-02 (logout BootSplash).
- W4: P2FHUB-02 (app_url_* as cx-link + setting-key title), P2FHUB-04 (eco3-tags hidden ≤600px), P2FQA-02 (kb-gaps type nowrap), P2FQUEUE-02 (chk-form border-box).
- W5: P2FHUB-03 (settings Try-again + Rb retry), P2FPROD-01 (title re-assert 0/50/200ms).

## Handoffs to PM/auditor

- Re-run failed audit questions at failing viewports with a session (most product routes 307 without one).
- App-wide `.cx-input`/`.cx-textarea` `box-sizing:content-box` + `width:100%` pattern in cx-kit.css — flagged by P2FQUEUE-02 as a future shared fix; not in scope here.
- No git ops performed; unrelated perf-pushdown WIP untouched. Worker stray files (`%TEMP%*.log`, `nul`) removed.
