# P2-FIX — how a FAIL finding becomes a fix mini-shard

Source: `../PLAN.md` Phase 2 ("FAILs become fix shards (same mini-shard
limits), each verified by re-running the same 8 questions").

## Workflow

1. ux-ui-expert lands a FAIL line in `results/ux3-<pkg>-<n>.md` (route,
   question, width, selector/region, screenshot, severity, suspected
   Phase-1 class).
2. TL groups FAILs by **root cause**, not by page: identical findings across
   routes sharing one component/class = ONE fix leaf. Seven defects in one
   file are still seven leaves only if they are seven causes; one cause on
   seven pages is one leaf.
3. TL writes each fix as a `## P2F<pkg><nn>:` section in
   `spec/fix-P2-<round>.md` (round = fix batch number), using the template
   below. Ids: `P2F` + package token + serial, e.g. `P2FQUEUE-02`.
4. Dispatch one leaf per agent. Owner per SKILL rules: `dev` for feature
   TSX/CSS, `test-engineer` only when the deliverable is a test. A fix that
   is purely an already-covered Phase-1 class gets flagged `see P1<A|B>-*`
   instead of a new leaf.
5. Verify = re-run ONLY the failed questions at the failed viewport(s) on the
   affected route(s), plus `npx eslint <files>` and `npx tsc --noEmit`.
   Global shell FAILs re-verify on the host route plus one route per group.
6. When all FAILs on a route pass, TL marks its results row `PASS (fixed in
   P2F<pkg><nn>)`; the route then feeds Phase-3 `page-contract.spec.ts`.

## Limits (unchanged from LIMITS.md)

One outcome, <=10 named files, <=10 actions, <=5 done checks, <=2000 changed
lines, <=10 estimated active minutes. Bigger → `RESHARD_NEEDED`, never a
marathon session.

## Fix-leaf template (TL copies into `spec/fix-P2-<round>.md`)

```
## P2F<pkg><nn>: <one root-cause outcome — the defect class, not "fix page">
Kind: mini
ID: P2F<pkg><nn>
Parent: fix-P2-<round>
Owner: dev
Depends: <other P2F ids editing the same file, else none>
Criteria: PLAN Phase 2 — FAIL <route> Q<n> in results/ux3-<pkg>-<n>.md
Skills: <role SKILL.md paths, or none>
Budget: files=<n>; actions=<n>; changed_lines=<n>; minutes=<n>

### Goal
<the one defect and its corrected behaviour>

### Files
- Edit: `src/features/<pkg>/components/<file>.tsx` | <region/symbol>
- Edit: `src/app/styles/<file>.css` | <rule family> (if styling)

### Context
- `specs/ux-ui-audit-v3/results/ux3-<pkg>-<n>.md` | FAIL line w/ screenshot
- `src/features/shared/components/ui/<Ref>.tsx` | shared component to reuse
- <max 5 pointers total>

### Contract
<props/classes/selectors the fix must keep; other FAILs on the same route
are separate leaves>
Out of scope: <everything not listed — no opportunistic restyling>

### Actions
1. <concrete fix step>
2. <reproduce + focused check>

### Done when
- Failed question(s) re-audited PASS at the failed width(s):
  <e.g. "Q4 PASS at 375px — no h-scroll on /tph">
- `npx eslint <files>` 0 warnings; `npx tsc --noEmit` clean

### Verify
- Run: `npm run dev` + browser at <width>px on <route> -> <observable result>
- Run: `npx eslint <files> && npx tsc --noEmit` -> clean

### Handoff
<what the auditor re-checks; write results/P2F<pkg><nn>.md <=10 lines>
```

## Batch hygiene

- Same-file writers always serialize (`Depends`), even different regions.
- Fixes that require a new Phase-1-style lint guard get noted for Phase-3 C3,
  not built here.
- `NEEDS_USER` if a FAIL needs design direction (e.g. missing component in
  shared/ui) — do not invent a new primitive inside a fix leaf.
