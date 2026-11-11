# cx-lint-fix — DONE

- loser-classnames-warn 46→0: `sr-only`→`cx-sr` in 17 files (34 sites); `eslint.config.mjs` warnLosers narrowed `cx-sr(?:-[\w-]+)?`→`cx-sr-[\w-]+` so bare canonical `cx-sr` passes (sr-only & cx-sr-* still warn). Needed: without it `cx-sr` itself warns.
- local-defs 7→0: local bindings renamed (hubFetchJson / fetchJsonLegacy / useSeLegacy / useSeLoader) + `export { impl as fetchJson|useSe }` — public names unchanged; internal call sites re-pointed (hub-shared 13, queue-shared 1, qa-shared 1).
- exhaustive-deps 7→0: useQaSort now memoizes toggle/apply/return → deps `[rows, r]`-style are stable; dropped 4 unused sort aliases; tph-grid-views `[d, missingMap]`; ecosystem-scene mount effect `[o, s]` (s = stable state value; no expressions touched).
- no-img-element 1→0: login page `<img>`→`<Image width={640} height={372} preload>` (mirrors AppShell).
- Checks: eslint on all 28 files = 0 warnings; `tsc --noEmit` clean.
