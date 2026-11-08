# 04-ui-library   (shard id: S04)
Owner: dev     Depends: S01     Criteria: PLAN #2,#3
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md

## Goal
Create the real component library at `src/features/shared/components/ui/` — typed React wrappers that emit the existing `cx-*` class contract — so downstream codemods replace every raw `<button>/<input>/<select>/<textarea>`.

## Files
Edit/create ONLY: `src/features/shared/components/ui/*.tsx`, `src/features/shared/components/ui/index.ts`
Read-only context: `src/features/shared/components/shell/ui.tsx` (seed primitives: Skeleton, Section, Chip, PageHead — wrap/re-export, do NOT move), `src/features/shared/components/shell/Toasts.tsx` (`toast()` API — re-export), `src/app/auth/login/page.tsx` (Field/Input usage pattern to support: name/type/autoComplete/required/placeholder), `src/app/globals.css` (class names: `cx-btn`, `cx-btn--primary/quiet/danger/small/icon`, `cx-input`, `cx-select`, `cx-textarea`, `cx-field`, `cx-field--wide`, `cx-error`, `cx-panel`, `cx-table`, `cx-tablewrap`, `cx-chip`, `cx-seg`, `cx-toggle`, `cx-note`, `cx-empty`, `cx-grid-2`)
Forbidden: everything else, `shell/ui.tsx` stays untouched, manifests/`.env*`

## Steps
1. `index.ts` barrel re-exporting all components.
2. `Button.tsx` — `forwardRef<HTMLButtonElement>`, props `{variant?: 'primary'|'quiet'|'danger', size?: 'sm', icon?: boolean} & ButtonHTMLAttributes`. Renders `<button className={cx('cx-btn', variant && 'cx-btn--'+variant, size==='sm'&&'cx-btn--small', icon&&'cx-btn--icon', className)}>`. Forward ALL native props incl `type`, `disabled`, `aria-*`, `data-*`, `title`, `onClick`, `style`. No children wrapping.
3. `Input.tsx`, `Select.tsx`, `Textarea.tsx` — `forwardRef` to the element, classes `cx-input`/`cx-select`/`cx-textarea` + caller `className`; forward every native prop (name, type, value, checked, required, autoComplete, placeholder, rows, options children).
4. `Field.tsx` — `{label, hint, error, htmlFor/id, wide?, children}` rendering `.cx-field` (`cx-field--wide` when wide) + `.field-label`/`.field-error` (`role="alert"`); auto-wires `id`/`htmlFor` and `aria-describedby` for hint/error.
5. `Card.tsx` → `.cx-panel` (+`cx-panel--pad`), `Section.tsx` → thin re-export of `shell/ui.tsx`'s `Section`, `Chip.tsx`/`StatusChip.tsx` → `.cx-chip` with `status`→`data-status`, `Note.tsx` → `.cx-note` + `data-status` + `role`.
6. `Seg.tsx` — options list rendering `.cx-seg` radio inputs; MUST keep `role="radiogroup"` semantics (status-validation e2e asserts it). `Toggle.tsx` → `.cx-toggle` switch. `Tabs.tsx` → `.cx-tabs` with `role="tablist"`/`tab`/`tabpanel`.
7. `Table.tsx` — `Table`, `THead`, `TBody`, `TR`, `TH`, `TD`, `TableWrap` (`.cx-tablewrap`) primitives.
8. `Modal.tsx` — `<dialog className="popup">`-based wrapper with `showModal()/close()` like `Popups.tsx:60-87`; preserve `aria-labelledby` wiring.
9. `Toast.tsx` — re-export `toast` from `shell/Toasts`; `Skeleton.tsx`, `Empty.tsx` (`<div className="cx-empty">` + title/sub props — class styled in cx-kit.css).
10. `'use client'` only where needed (interactive components); keep components dumb — styling comes entirely from cx-kit.css classes, zero inline style except passthrough props.
11. Type every props interface strictly; export prop types. Keep names exactly `Button, Input, Select, Textarea, Field, Card, Section, Chip, StatusChip, Note, Seg, Toggle, Tabs, Table(+parts), Modal, Toast/toast, Skeleton, Empty`.

## Done when
- `import { Button, Field, Input, Select } from '@/features/shared/components/ui'` compiles; all 17+ exports exist.
- Verify: `npx tsc --noEmit` -> 0 errors; `npx eslint src/features/shared/components/ui` -> clean.
