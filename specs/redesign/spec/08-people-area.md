# 08-people-area   (shard id: S08)
Owner: dev     Depends: S03,S04     Criteria: PLAN #1,#3,#6
Skills: none

## Goal
Migrate the People app: authored `styles/people.css` for its page families, and replace every raw control in cx-people components with `ui/` primitives.

## Files
Edit/create ONLY: `src/app/styles/people.css` (new), `src/features/cx-people/components/{agents-page,coaching-page,meetings-page,my-actions-page,notes-page,one-on-ones-page,pw,shared,tl-tasks-page}.tsx`, `src/app/{agents,coaching,meetings,my-actions,notes,one-on-ones,tl-tasks}/page.tsx`
Read-only context: `src/app/legacy-apps.css:754-1126` (people section source rules), `src/app/theme.css` + `src/app/cx-kit.css`, `src/features/shared/components/ui/index.ts`
Forbidden: everything else

## Steps
1. Author `src/app/styles/people.css`: port every `[data-app="people"]`-scoped FAMILY rule from `legacy-apps.css:754-1126`. SKIP shared re-declares (`.cx-*`,`.rail*`,`.nav-*`,`.va-*`, token block). Keep `[data-app="people"]` scoping and class names identical; `var(--cx-*)` values only; tighten paddings/row heights to the dense contract.
2. Add `import '@/app/styles/people.css'` to each listed route `page.tsx`.
3. Codemod raw controls in the 9 cx-people files → `<Button>/<Input>/<Select>/<Textarea>/<Seg>/<Field>/<Toggle>/<Modal>`; preserve all `data-*`, `aria-*`, `role`, `name`, `type`, `id`, `htmlFor`, handlers.
4. Waivers: `// eslint-disable-next-line -- kept raw: <reason>` only.
5. `grep -n "<button\|<input\|<select\|<textarea" src/features/cx-people` → 0 (or waived only).

## Done when
- `people.css` covers the family selector set on new tokens; routes import it; no raw controls in cx-people.
- Verify: `npx tsc --noEmit` -> 0; `npx eslint src/features/cx-people` -> clean; shots for `agents`,`one-on-ones`,`meetings` reskin correctly.
