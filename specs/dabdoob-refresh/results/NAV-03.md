# NAV-03 — DONE

- File: `e2e/nav-collapse.spec.ts` (new, ~146 lines, 4 tests).
- Covers Verify bullets: group-label toggle (aria-expanded + ul[hidden], current group expanded), open-set persistence in `sessionStorage['cx.nav-groups']` across client nav, SPA no-reload proof (`window.__navStay` + `.boot-splash` hidden + `aria-current` + `#main` content), mobile `.nav-open` + toggle at 375px.
- Deterministic: no fixed sleeps; `waitForURL`/attribute polling only.
- Check: `npx playwright test e2e/nav-collapse.spec.ts` -> 20 passed (5 projects x 4), twice (17.7s, 17.0s). `--list` shows all 4.
- Note: `bootedNav` pins 1280px so mobile/tablet projects exercise desktop nav; the 375px case is its own test.
- No source edits needed; NAV-01 hooks all present.
