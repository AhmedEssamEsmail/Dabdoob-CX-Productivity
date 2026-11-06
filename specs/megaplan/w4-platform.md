# Wave 4 — Platform & ops sweep (6 WPs)

> Residual items of `../cx-hub/70-utilities.md` not yet verified + cross-cutting parity sweeps. Depends on: W0 (and ideally W1 fixes landed so pages are stable).

## WP-40 — Admin health/jobs UI parity

- Verify `admin` page tabs cover: roster editor, settings editor (typed validation incl. `updated_by/at`), dropdown choices, email log viewer, scheduled jobs/health (`hbRowState_` ok/warn/down/idle rows + last-15-events + "Awaiting first run"), connected apps (read-only per D1), appearance.
- Compare against `Nm` closure deps (Dm/Im/Ln/Pf/Tm) — every tab's DOM/copy must match. Fix gaps inline or add fix-WPs.
- Output: `audits/admin-ui.md`.

## WP-41 — admin coverage sweep (mail log, options, popups)

- Confirm email log reads `mail_log` table, options editor edits the `options` service lists, and popups management exists **iff** the legacy admin had it (check `Nm` closure — don't invent UI). Record per-item: parity | missing-in-legacy | missing-in-port → WP ref.

## WP-42 — view-as write-refusal sweep

- Every API route that mutates data must refuse under View-as (`assertWritable`/`viewAsGuard_` at the data layer, not just the route). Enumerate all `app/api/**` POST/PUT/DELETE handlers; for each: guard present file:line, or gap. Test: agent-viewing-as-admin cannot write; admin-viewing-as-agent cannot write.
- Output: `audits/viewas-sweep.md` matrix + fixes for unguarded writes.

## WP-43 — routing/compat sweep

- Re-generate the route audit: every legacy registry path → page/placeholder/redirect (verify `route-audit.json` still accurate); `#/path`, `?page=`, `?tab=` shim coverage incl. query forwarding; unknown paths → redirect('/') per catch-all; state screens (not-set-up/no-access/nothing-for-you/could-not-start) on every page; `BUILT_ROUTES` registry completeness.
- Output: updated `route-audit.json` + `audits/routing.md`.

## WP-44 — appearance/i18n matrix

- Verify per `../legacy-parity/03`: theme auto/light/dark, accents pine/blue/plum/rust, reduce transparency/motion, en/ar toggle + RTL layout on a representative page per group; `cx.appearance` storage key only; 80-string Arabic dictionary coverage (strings the pages actually use — list missing keys).
- Output: `audits/appearance.md` + fixes for missing coverage.

## WP-45 — parity-verification tooling decision

- The old `.devin/work` screenshot harness (shoot-legacy/shoot-new/diff-parity) was deleted. Decide and implement one of:
  a) **DOM/class-diff harness** (recommended given no deployed legacy apps): script that loads each `.closure.js`, renders the component tree statically with fixture payloads, diffs class vocabulary + copy + element order vs the ported TSX render (react-dom/server or component-AST diff) → per-page report.
  b) **Documented code-level acceptance**: per-page checklist sign-off in `audits/<module>.md` (from W1) as the parity evidence, noting why pixel-parity is deferred until legacy deployments are reachable.
- Implement (a) at least for the highest-risk pages (qa-forms, audit-queue, scheduler, tl-performance, meetings) or complete (b) with an explicit owner-visible caveat.
- Output: `audits/parity-method.md` + tooling under `.devin/work/` or `scripts/`.

## Wave-4 exit criteria

`audits/{admin-ui,viewas-sweep,routing,appearance,parity-method}.md` committed; unguarded writes fixed; updated route-audit.json committed.
