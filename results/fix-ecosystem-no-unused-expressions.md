# fix-ecosystem-no-unused-expressions

- Status: DONE
- Files: `src/features/cx-hub/components/ecosystem-scene.tsx`, `src/features/cx-hub/components/ecosystem-page.tsx`
- Fixed: 201 `@typescript-eslint/no-unused-expressions` in ecosystem-scene.tsx, 3 in ecosystem-page.tsx (statement-level `&&`/`||`/ternaries/comma-sequences -> `if`/real statements; behavior preserved, ASI-safe `;` kept where a line starts with `(`).
- Checks: `npx eslint` on both files -> 0 warnings for this rule (only pre-existing `react-hooks/exhaustive-deps` at scene ~3081 remains, out of scope). `npx tsc --noEmit` -> PASS (empty log).
- Rollback copies: `%TEMP%/ecosystem-scene.tsx.bak`, `%TEMP%/ecosystem-page.tsx.bak`
