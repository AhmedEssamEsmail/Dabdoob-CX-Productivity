# 07-queue-area   (shard id: S07)
Owner: dev     Depends: S03,S04     Criteria: PLAN #1,#3,#6
Skills: none

## Goal
Migrate the Queue app: authored `styles/queue.css` for its page families (queue/aging/checkins/analytics/scheduler/heatmap classes), and replace every raw control in cx-queue components with `ui/` primitives.

## Files
Edit/create ONLY: `src/app/styles/queue.css` (new), `src/features/cx-queue/components/{aging-page,analytics-page,checkins-page,heatmap-page,queue-page,scheduler-page,shared}.tsx`, `src/app/{queue,aging,checkins,analytics,heatmap,scheduler}/page.tsx`
Read-only context: `src/app/legacy-apps.css:480-753` (queue section source rules), `src/app/theme.css` + `src/app/cx-kit.css`, `src/features/shared/components/ui/index.ts`
Forbidden: everything else

## Steps
1. Author `src/app/styles/queue.css`: port every `[data-app="queue"]`-scoped FAMILY rule from `legacy-apps.css:480-753`. SKIP shared re-declares (`.cx-*`,`.rail*`,`.nav-*`,`.va-*`, token block — cx-kit owns them). Keep `[data-app="queue"]` scoping + every family class name identical; colors/spacing/type strictly `var(--cx-*)`, no hex, no out-of-scale font sizes.
2. Heatmap/analytics grids: tighten cell/table paddings to the dense contract; heat colours stay status-token driven (`--cx-age-*`/`--cx-status-*`).
3. Add `import '@/app/styles/queue.css'` to each listed route `page.tsx`.
4. Codemod raw controls in the 7 cx-queue files → `<Button>/<Input>/<Select>/<Textarea>/<Seg>/<Field>`; preserve all `data-*` (`data-age`,`data-band`,`data-status`), `aria-*`, `role`, `name`, `type`, `id`, handlers.
5. `.dq-head` usage (queue-page `dq-*` head rows) — `dq-head` itself is a shared class (cx-kit); page-specific `dq-*` extras go into queue.css.
6. Waivers: `// eslint-disable-next-line -- kept raw: <reason>` only when ui/ cannot express the control.
7. `grep -n "<button\|<input\|<select\|<textarea" src/features/cx-queue` → 0 (or waived only).

## Done when
- `queue.css` covers the family selector set on new tokens; routes import it; no raw controls in cx-queue.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/features/cx-queue` -> clean; shots for `queue`,`heatmap`,`scheduler` reskin correctly.
