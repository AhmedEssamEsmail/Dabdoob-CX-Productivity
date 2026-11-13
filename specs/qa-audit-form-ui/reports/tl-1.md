# tl-1 — qa-audit-form-ui FIX report

Mode: FIX. Input: `reports/debug-1.md` (dbg-1..dbg-3, all blocking) + PLAN.md
symptom 4 (`.qa-score` oversized). 4 findings -> 4 serial mini-leaves in
`spec/fix-debug-1.md` (all touch quality.css -> `Depends` chain enforced;
check_shards.py PASS x4). Owner: dev x4.

## Changed files (reviewer DELTA scope)
- `src/features/cx-quality/components/qa-shared.tsx` (+25/-18) — AuditForm
  answer + "why it failed" `Seg` -> `Select`: empty first option, same
  `O`/`g` state keys, `aria-label={F.text}` / `aria-labelledby=qa-why-*`,
  fatal questions keep Pass/Fail only; `missing`/`A` gating + `Z` payload
  untouched.
- `src/app/styles/quality.css` (+11/-6) — L30 dead `.cx-seg` tint restyled
  to `.qa-q[data-answer=fail] .cx-select`; `.qa-request` flex -> auto-fit
  minmax(14rem,1fr) grid (`__why`/`.cx-error` span, `.qa-actions` natural
  width); new `#qa-when{inline-size:auto;max-inline-size:100%}`;
  `.qa-score` compact (`__num` -> `--cx-text-lg`, padding `space-1
  space-3`, flex baseline; sticky dropped as meaningless).

## Leaves — all DONE (results/dbg1-0{1..4}.md)
| Leaf | Finding | Evidence |
|---|---|---|
| dbg1-01 | dbg-2 Seg->Select | vitest audit-form-controls 2/2 green; tsc+eslint clean |
| dbg1-02 | dbg-1 .qa-request grid | CSS only; targeted tests ok |
| dbg1-03 | dbg-3 #qa-when | +1 rule; tests ok |
| dbg1-04 | plan-4 .qa-score compact | ~4 lines; tests ok |

Total source churn ~60 lines vs 2000 cap. No RESHARD_NEEDED, no blocked.

## Integration gates (reports/final-gates.log)
- `npx tsc --noEmit` -> exit 0
- `npx eslint` (changed tsx) -> exit 0, 0 warnings
- `npx vitest run tests/quality` -> 11/12. Sole failure:
  `qe-fd-cache.test.ts` "logs cache failures to refresh_log" — PRE-EXISTING
  baseline failure (qeReadTicketDetail/refresh_log backend module,
  untouched by this spec; impossible for CSS/audit-form diff to cause).
  Log: reports/qe-fd-cache.log. Recommend PM route to a separate debug
  task; NOT a regression of this fix.

## Manual gate not run
375/1024px browser check (PLAN gate #4) needs human/UX gate — PM's
reviewer should verify no h-scroll + select accessible names.

Notes: `tests/quality/audit-form-controls.test.tsx` (debugger-authored
regression test) is untracked baseline, passes post-fix. Removed a stray
0-byte `nul` artifact at repo root.
