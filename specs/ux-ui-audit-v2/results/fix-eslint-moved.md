# fix-eslint-moved — react-hooks/refs errors in S13-split files
Status: done
Files: edited `src/features/cx-quality/components/audit-queue-page.tsx` (1 line: `y(w.queueId)` → `y(String(w.queueId))` — `any` arg read as possible ref); edited `src/features/cx-hub/components/ecosystem-scene.tsx` (tagRefs bag `s` converted `useRef({})` → `useState(() => ({}))[0]`; `s.current[T]`→`s[T]`, `tagRefs={s.current}`→`tagRefs={s}`).
Pre-existing check: audit `y`/focus-restore refs are new in the split (HEAD monolith had no `qaInvoker`); eco `tagRefs={s.current}` render-read was introduced by the S13-02 extraction (monolith wrote `s.current[_]` only inside a ref callback). Both fixed properly, no disables.
Checks: `npx eslint` on both files → 0 errors (212 pre-existing verbatim-port warnings); `npx tsc --noEmit` clean; goldens quality 64/64 + hub 10/10 pass.
Handoff: none.
