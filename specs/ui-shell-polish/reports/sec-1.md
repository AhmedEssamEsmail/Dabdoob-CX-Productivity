# sec report - ui-shell-polish - round 1 (FULL)

Verdict: PASS
Open: 0/0/0/1

Scope: cumulative working-tree diff vs HEAD (round-1 fix + qa1/qa2 follow-ups):
`src/app/auth/login/page.tsx` (focus), `src/features/shared/components/shell/AppShell.tsx`,
`src/features/cx-hub/components/admin-page.tsx`, `src/app/cx-kit.css`,
`src/app/refresh.css`, `src/app/styles/quality.css`, `.gitignore`,
`e2e/ui-shell-polish.spec.ts` (new). Presentational bugfix per PLAN.md non-goals —
no auth-request, data, or dependency changes.

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | `e2e/ui-shell-polish.spec.ts:140` | Credential literal `'E2E-cx-local-2026!'` is duplicated in the spec instead of `E2E_PASSWORD`; if the fixture password is rotated via `E2E_USER_PASSWORD` env this spec silently diverges, and the literal spreads to one more file in history. Test-only seeded account — logged for hygiene only. | Replace the literal with `E2E_PASSWORD` (already exported by `e2e/users.ts`, imported via the existing `./users` import). | dev |

## Checklist applied to the diff

- **AuthN/Z — clean.** `handleLogin` still POSTs `{email, password}` to same-origin
  `/api/auth/login`; no client-supplied identity/role added. Reminders `Toggle`
  calls the same `Ln.saveConfigSetting('reminders_enabled', next)` as the removed
  button (`!on` → `next` equivalent); server-side authz untouched by the diff.
  Nav `router.push(href)` unchanged; `href` comes from the page registry, not
  user input — no open-redirect surface.
- **XSS/injection — clean.** Overlay built via `createElement` + `textContent`
  (`page.tsx:43-60`); no `innerHTML`/`dangerouslySetInnerHTML`. Server error
  string rendered as React text at `page.tsx:157` — escaped. No inline styles —
  CSP-compatible.
- **Overlay lifecycle — clean.** All failure paths dismiss: `!response.ok` →
  `catch` → `dismissOverlay` (`:92-93`); success → `navWatch` self-clears on
  pathname change or hard 15s timeout (`:80-91`), which also restores
  `setLoading(false)` + error. Interval is `window`-scoped and self-clearing, so
  no leak on unmount; `setState` after unmount is a React no-op. Removed
  `finally { setLoading(false) }` leaves no path where the form is stuck with no
  overlay and no error — worst case is bounded at 15s. Re-entry is blocked by
  the disabled submit (implicit submission respects `disabled`); a hypothetical
  double-submit only yields a second idempotent login POST + self-dismissing
  overlay.
- **Removed-code review — clean.** `startViewTransition`/`prefersReducedMotion`
  wrapper and dead `::view-transition-*` CSS were UX-only; no security invariant
  removed. `whoParts`/`initials` drop is dead-code removal (topbar computes its
  own `topInitials`).
- **Secrets/config — clean + one improvement.** No secrets, `.env*`, manifests,
  or lockfiles touched. `.gitignore` gains `/logs/` — positive, keeps dev-server
  logs (which can embed request detail) out of history.
- **Data exposure — none.** No `select('*')`, no PII logging. `qaProbe` in the
  e2e spec logs ≤1200 chars of API responses into test artifacts only.
- **Dependencies — n/a.** No manifest/lockfile change; `npm audit` not run.

## Not verified / assumptions

- `/api/auth/login`, `/api/auth/google`, `src/proxy.ts`, and the
  `Ln.saveConfigSetting` data layer were not in the diff — server-side authz
  taken as unchanged, not re-audited.
- `db` flag not set in PLAN.md — RLS/supabase checklist not applied.
- Reduced-motion honoring of the new `data-entry="calm"`/`nav-pending`
  affordances is a UX-gate concern (QA), not a security finding; overlay spinner
  itself does disable animation under `prefers-reduced-motion`
  (`refresh.css:477`).
- Overlay is a full-viewport fixed layer without focus trapping — an
  accessibility note, not a security finding; keyboard re-entry to the disabled
  form is not possible in the 15s window regardless.
