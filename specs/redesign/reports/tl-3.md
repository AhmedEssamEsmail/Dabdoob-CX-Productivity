# tl-3 — FIX round for reports/ux-1.md (verdict FAIL: 1B/2H/7M/5L)

## Shards → done
- `fix-ux-1-cxkit` (dev): ux-1 BLOCKER + ux-2/ux-3 HIGH + ux-7/8/9/10 MED — all in `src/app/cx-kit.css`. Toggle pill/checked/focus states re-authored, focus rings on hidden inputs (seg/toggle/switch), field borders → `--cx-line-strong`, 1180/900/600px collapse breakpoints ported from globals.css, `.cx-seg` wrap restored, `tr[data-age]` tint+stripe re-added, `.pending` logical padding (RTL fix).
- `fix-ux-1-theme` (dev): ux-4 + ux-5 in `src/app/theme.css`. `--cx-ink-3` mix 72%→85% → 4.84:1 light / 5.05:1 dark; dark pine `--cx-accent-hover` → #59b795 → 5.29:1 on accent-soft.
- `fix-ux-1-btnvar` (dev, wave 2 — needed cx-kit.css after cxkit): ux-6 — `:root .cx-btn--small` (2rem/xs) + `:root .cx-btn--icon` (square --cx-target) authored in cx-kit.css; Button.tsx + UI-SYSTEM.md already correct, unchanged.

## Changed files (DELTA scope)
- `src/app/cx-kit.css`, `src/app/theme.css` — source changes
- `specs/redesign/spec/fix-ux-1-*.md` (3 new), `specs/redesign/TRACKER.md`, this report

## Gates (FIX2)
- `npx tsc --noEmit` PASS · `npx eslint` 0 errors (devs ran full `.`; TL scoped ui+app clean) · `npx vitest run` PASS 1140 · `node .devin/work/shoot-new.mjs` PASS 103 shots / 0 errors.

## Deferred (LOW → no action)
ux-11 ladder pressed-state, ux-12 Tabs RTL (unused component), ux-13 forced-colors field focus, ux-14 eco3-tag doc exemption (overlaps qa-6), ux-15 .pw-seg in hub scope (latent).

## Open issues / notes
- Scope check: `git status` shows ~92 files — cumulative uncommitted redesign work; FIX2 delta is only the 2 CSS files (verified vs dev reports + shard Files lists).
- Reviewers may want a ux-2 re-run; prior LOWs (qa-4/5/6/7) still deferred.
</content>
