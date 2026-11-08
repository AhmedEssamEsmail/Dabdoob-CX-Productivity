# UI System

The design system behind CX-Hub: a refined-neutral ops console — hairline
borders, one restrained accent, tight type hierarchy, dense data surfaces.
Tokens live in `src/app/theme.css`, the class layer in `src/app/cx-kit.css`,
and the React primitives in `src/features/shared/components/ui/`.

Reference screenshots: `.devin/work/shots/redesign/` (visual reference only;
no images are copied into this doc).

> **Global rule:** on every component below, `className` merges onto the
> component's `cx-*` base class via the `cx()` helper — it appends, never
> replaces.

## Overview

- **Token layer.** Every color, size, radius, shadow, and duration is a CSS
  custom property. Components never hard-code values; `cx-kit.css` authors
  rules as `:root .cls` and reads `--cx-*` / `--*` tokens only.
- **Class contract.** React primitives emit stable `cx-*` class names that
  `cx-kit.css` styles in place. The same class names still exist for
  hand-rolled markup (legacy surfaces), so a primitive and raw markup look
  identical.
- **Density.** Data surfaces are dense by default (`--cx-text-sm` ≈ 13 px,
  table rows 2.25 rem); touch pointers get taller targets via
  `--cx-target`.
- **Themes.** Light is the default; dark activates via `data-theme="dark"`
  or `prefers-color-scheme` when no explicit light choice is stored. Four
  accents (`pine` default, `blue`, `plum`, `rust`) swap the accent ramp.

## Tokens

Token names below are the real custom properties from `src/app/theme.css`.
Where a token is not re-declared in dark mode the dark column reads *same*.

### Palette

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--paper` / `--cx-bg` | `#f6f7f8` | `#131a20` | App background |
| `--surface` / `--cx-surface` | `#ffffff` | `#1a232b` | Cards, rail, dialogs |
| `--cx-surface-2` | paper/surface mix | same | Subtle filled cells (`.cx-calc`) |
| `--cx-surface-sunken` | line/paper mix | same | Hover fills, switch track |
| `--ink` / `--cx-ink` | `#1d2632` | `#e8edf1` | Primary text |
| `--ink-2` / `--cx-ink-2` | `#4f5d6b` | `#9aa9b4` | Secondary text |
| `--cx-ink-3` | ink-2/surface mix | same | Faint text, hints |
| `--line` / `--cx-line` | `#e0e5ea` | `#2c3742` | Hairline borders |
| `--line-strong` / `--cx-line-strong` | `#828a96` | same | Stronger borders, inputs |
| `--pine` | `#14332b` | `#0d1f1a` | Accent deep (dark surface) |
| `--pine-2` / `--cx-accent` | `#1f6b57` | `#3d8f76` | Primary accent |
| `--cx-accent-hover` | `--pine` | `#59b795` | Accent fill on hover |
| `--cx-accent-text` | `--cx-accent-hover` | same alias | Accent text on neutral/tinted surfaces |
| `--cx-accent-ink` | `#ffffff` | `#08130f` | Text on accent |
| `--cx-accent-soft` | pine-2 12% on surface | pine-2 18% on surface | Accent tint fills |
| `--focus` / `--cx-focus` | `#2f6fed` | `#86a8ff` | Focus ring |
| `--danger` | `#b3261e` | `#ff8a80` | Destructive accents |
| `--signal` / `--signal-ink` / `--signal-hover` | `#e9a412` / `#3a2a00` / `#f7c65a` | `#f0b429` / same / same | Attention banner (view-as) |
| `--ok` | `#1f7a55` | `#4cb782` | Success accent |
| `--scrim` | `rgba(15,23,32,.5)` | `rgba(0,0,0,.62)` | Overlay dim |
| `--hover` | ink 6% transparent | same | Generic hover wash |

Use `--cx-accent-text` for links, selected labels, navigation text and
accented metrics. Keep `--cx-accent` / `--cx-accent-hover` for fills and
`--cx-accent-ink` for text on those fills. Dark pine's base fill is suitable
for UI boundaries (3:1), not small text (4.5:1).

Contrast regression gates (no app server, credentials or remote writes):

```bash
npx vitest run tests/lib/accent-contract.test.ts
npx playwright test --config=tests/ui/playwright.config.ts
```

The browser matrix covers all four accents plus the default, explicit and
system themes, five neutral/tinted surfaces, selected controls and primary
button hover in Chromium, Firefox and WebKit. Computed colors are converted
to sRGB by the browser, then measured against WCAG AA thresholds. Browser
artifacts are saved under `test-results/ui-contrast/`.

### Type

Theme-independent (same in light and dark). `--cx-*` aliases keep the
legacy contract.

| Token | Value | Purpose |
|---|---|---|
| `--font` / `--cx-font` | `"IBM Plex Sans", "IBM Plex Sans Arabic", system-ui, …` | UI font (Latin + Arabic) |
| `--font-mono` / `--cx-font-mono` | `"IBM Plex Mono", ui-monospace, …` | Code / numeric mono |
| `--text-xs` … `--text-3xl` | `.75rem` … `2.5rem` | Type scale |
| `--cx-text-xs` … `--cx-text-3xl` | aliases of the above | Legacy alias contract |
| `--text-title` | `clamp(1.5rem, 1.25rem + .9vw, 2.125rem)` | Page title |
| `--lh-tight` / `--lh-snug` / `--lh-body` | `1.2` / `1.35` / `1.5` | Line heights |
| `--cx-lh-latin` / `--cx-lh-arabic` | `1.45` / `1.8` | Script-aware leading |
| `--cx-lh-latin-dense` / `--cx-lh-arabic-dense` | `1.3` / `1.6` | Dense-surface leading |
| `--w-regular` … `--w-bold` | `400` / `500` / `600` / `700` | Weights (`--cx-weight-*` aliases) |

### Radius, elevation, motion

| Token | Value | Purpose |
|---|---|---|
| `--radius-s` / `--cx-radius-bar` | `4px` | Bars, skeletons, chips-in-tables |
| `--radius-m` / `--cx-radius-control` | `8px` | Controls: buttons, inputs, chips |
| `--radius-l` / `--cx-radius-object` | `12px` | Objects: cards, dialogs, notes |
| `--shadow-1` | `0 1px 2px rgb(16 24 34 / .07)` | Resting hairline shadow |
| `--shadow-2` | `0 6px 20px rgb(16 24 34 / .1)` | Raised surfaces |
| `--shadow-3` | `0 24px 60px rgb(10 18 28 / .28)` | Top-most overlays |
| `--cx-shadow-pop` | `0 12px 32px rgb(15 23 34 / .14)` | Popovers, dialogs, toasts |
| `--cx-focus-ring` | `0 0 0 2px var(--surface), 0 0 0 4px var(--focus)` | Double focus halo |
| `--ease` / `--cx-ease` | `cubic-bezier(.2,.65,.3,1)` | Standard easing |
| `--dur-fast` | `.12s` | Micro transitions (`--cx-dur`) |
| `--dur` | `.18s` | Control transitions |
| `--dur-slow` | `.26s` | Panel/dialog entrances |
| `--cc-sweep` / `--cc-stagger` | `.4s` / `30ms` | Chart sweep animation |

Dark re-declares `--shadow-1/2/3` and `--cx-shadow-pop` with black alphas.

### Spacing, layout, density

| Token | Value | Purpose |
|---|---|---|
| `--space-1` … `--space-8` / `--cx-space-*` | `.25rem` … `4rem` | Spacing scale (1–8) |
| `--gutter` / `--cx-gutter` | `clamp(1rem, 2.5vw, 3rem)` | Page side gutter |
| `--main-pad` | `clamp(1.25rem, 2.5vw, 2rem)` | Main content padding |
| `--fill-h` | `calc(100vh - 2 * var(--main-pad))` | Full-height pages |
| `--rail-w` / `--cx-rail-width` | `clamp(13.5rem, 16vw, 16rem)` | Nav rail width |
| `--rail-w-mini` | `3.5rem` | Collapsed rail |
| `--cx-topbar-height` | `3rem` | Sticky offsets |
| `--page-narrow` | `62rem` | Narrow page measure |
| `--dialog-s` / `--dialog-m` / `--dialog-l` | `30rem` / `38rem` / `52rem` | Dialog width tiers |
| `--target` / `--cx-target` | `2.25rem` (`2.75rem` on `pointer: coarse`) | Minimum control height |

### Status triples

Each status is a `fg`/`bg`/`edge` triple consumed via `data-status` on
`.cx-chip`, `.cx-note`, `.cx-dayrail__slot`, `.cx-need`, `.cx-list` rows,
and friends (`--st-fg` / `--st-bg` / `--st-edge`). Tone accents
(`data-tone="work|team|quality|system"`) map to the same ramps.

| Status | `--cx-status-*-fg` (L / D) | `--cx-status-*-bg` (L / D) | `--cx-status-*-edge` (L / D) |
|---|---|---|---|
| neutral | `#46546a` / `#a9b7cc` | `#e6eaf1` / `#1c2a3f` | `#8a96a8` / `#6d7f98` |
| info | `#0f5a96` / `#82bdee` | `#e3eefa` / `#15304d` | `#176aaa` / `#5aa8e6` |
| ok | `#17744a` / `#5fd1a0` | `#e4f4ec` / `#123325` | `#2e9a69` / `#3fae80` |
| warn | `#7d5000` / `#f0bd62` | `#fdf0d6` / `#36280d` | `#c68a1a` / `#c68a1a` |
| bad | `#b3261e` / `#ff9a90` | `#fbe9e7` / `#3d1a18` | `#d9483f` / `#e5584d` |

### Age ramp

`data-age="0"`…`"6"` drives `--age-edge` / `--age-ink` / `--age-tint` for
`.cx-agechip`, `.cx-ladder__seg`, and age grids. Edges run cool-gray
(`--age-0 #9aa5b1`) through hot red (`--age-6 #6b1f22`); in dark mode the
ramp inverts (`--age-0 #5b6673` → `--age-6 #d71f45`) and `--cx-age-ink-*`
flips so labels stay AA on the fill. Light `--cx-age-ink-0..2` are
`#0f1720`, `3..5` `#ffffff`; dark `0` and `6` are `#ffffff`, `1..5`
`#0b121d`.

## Components

Exports from `src/features/shared/components/ui/` (barrel `index.ts`).
`Section`, `Skeleton`, and `toast`/`Toasts` re-export shell implementations;
their props are documented from those sources.

### Button

`cx-btn` + `cx-btn--{variant}` + optional `cx-btn--small` / `cx-btn--icon`.
Geometry: `min-height: var(--cx-target)`, `radius-control`, 1 px
`--cx-line-strong` border, `--cx-text-sm` strong.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'primary' \| 'quiet' \| 'danger'` | — (surface) | Accent fill / transparent / bad-tint |
| `size` | `'sm'` | — | `cx-btn--small` (2 rem min-height) |
| `icon` | `boolean` | `false` | `cx-btn--icon` |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | |
| …rest | `ButtonHTMLAttributes` | | `disabled`, `onClick`, `aria-*`, etc. |

| Variant | State | Class output | Usage |
|---|---|---|---|
| primary | default / hover | `cx-btn cx-btn--primary` | `<Button variant="primary">Save</Button>` |
| primary | disabled | `:disabled` → opacity .55 | `<Button variant="primary" disabled>…` |
| primary | loading | add `is-busy` via className | `<Button variant="primary" className="is-busy">…` |
| quiet | default / hover | `cx-btn cx-btn--quiet` | `<Button variant="quiet">Cancel</Button>` |
| danger | default / hover | `cx-btn cx-btn--danger` | `<Button variant="danger">Delete</Button>` |
| any | small | `+ cx-btn--small` | `<Button size="sm">Apply</Button>` |
| any | icon-only | `+ cx-btn--icon` | `<Button icon aria-label="Close">…` |

### Input

Single-line text input → `cx-input`.

| Prop | Type | Notes |
|---|---|---|
| …rest | `InputHTMLAttributes<HTMLInputElement>` | `type`, `value`, `placeholder`, `disabled`, `aria-invalid`, etc. |

| State | Trigger | Appearance |
|---|---|---|
| default | — | Surface bg, `--cx-line` border, `radius-control` |
| hover | `:hover` | Border → `--cx-line-strong` |
| focus | `:focus-visible` | Border → `--cx-focus`, `--cx-focus-ring` halo |
| invalid | `aria-invalid="true"` | Border → `--cx-status-bad-edge` |
| disabled | `disabled` | Native disabled styling |

`<Input placeholder="Search…" aria-label="Search" />`

### Select

Native `<select>` → `cx-select`. Same state table as Input (hover/focus/
invalid via `aria-invalid`); `cursor: pointer`.

`<Select aria-label="Status"><option>Open</option></Select>`

### Textarea

`<textarea>` → `cx-textarea`. Adds block padding and `resize: vertical`;
same hover/focus/invalid states.

`<Textarea rows={4} placeholder="Notes…" />`

### Field

Label + control + hint/error wrapper → `cx-field` (`cx-field--wide` when
`wide`). Wires `id`, `htmlFor`, and `aria-describedby` onto a single
React-element child automatically.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | `ReactNode` | required | `.field-label` |
| `hint` | `ReactNode` | — | `.field-hint`, `${id}-hint` |
| `error` | `ReactNode` | — | `.field-error` `role="alert"`, `${id}-error` |
| `id` | `string` | `useId()` | Control id (child `id` wins) |
| `wide` | `boolean` | `false` | `cx-field--wide` grid span |
| `children` | `ReactNode` | — | Typically one `<Input>`/`<Select>`/`<Textarea>` |
| …rest | `HTMLAttributes<HTMLDivElement>` | | |

| State | Output | Usage |
|---|---|---|
| default | label + control | `<Field label="Name"><Input /></Field>` |
| with hint | `+ .field-hint` | `<Field label="Email" hint="Work address">…` |
| with error | `+ .field-error role="alert"` | `<Field label="Qty" error="Required">…` |
| wide | `+ cx-field--wide` | `<Field label="Notes" wide>…` |

### Card

Surface panel → `cx-panel`, `cx-panel--pad` when `pad`.

| Prop | Type | Default |
|---|---|---|
| `pad` | `boolean` | `false` |
| …rest | `HTMLAttributes<HTMLDivElement>` | |

| Variant | Class output | Usage |
|---|---|---|
| bare | `cx-panel` | `<Card><TableWrap>…` (flush content) |
| padded | `cx-panel cx-panel--pad` | `<Card pad><h3>…</h3></Card>` |

### Section

Re-export of the shell `Section` (`shell/ui.tsx`). Non-collapsible renders
`section.cx-section` with `.cx-section__head` / `__title` / `__hint`;
collapsible wraps content in `details.cxp-fold` and persists open state in
`localStorage["cx.sections-open"]`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `id` | `string` | required | Anchor + fold-memory key |
| `title` | `ReactNode` | required | `.cx-section__title` |
| `hint` | `ReactNode` | — | `.cx-section__hint` |
| `collapsible` | `boolean` | `false` | Enables fold |
| `defaultOpen` | `boolean` | `true` | Initial fold state |
| `summary` | `ReactNode` | — | Fold header summary (`.cxp-fold__sum`) |
| `lead` | `ReactNode` | — | Shown when open and when closed |
| `forceOpen` | `boolean` | `false` | Overrides fold state |
| `unmount` | `boolean` | `false` | Unmount children when closed |
| `children` | `ReactNode` | — | |

| Variant | State | Usage |
|---|---|---|
| static | default | `<Section id="s1" title="Overview" hint="Last 7 days">…` |
| fold | `collapsible` closed | `<Section id="s2" title="Details" collapsible defaultOpen={false} summary="3 items">…` |
| fold | `collapsible` open | same, `defaultOpen` |

### Chip

Inline status/tag pill → `cx-chip` with `data-status`. A `::before` dot
takes `--st-edge`; `plain` suppresses it.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `status` | `string` | — | `data-status` → status triple |
| `plain` | `boolean` | `false` | `cx-chip--plain`, no dot |
| `children` | `ReactNode` | — | Label text |
| …rest | `HTMLAttributes<HTMLSpanElement>` | | |

| Variant | State | Usage |
|---|---|---|
| statused | `status="ok"` etc. | `<Chip status="warn">At risk</Chip>` |
| plain | `plain` | `<Chip plain>Draft</Chip>` |
| neutral | no `status` | `<Chip>Tag</Chip>` (sunken/line-strong) |

### StatusChip

Thin wrapper over `Chip` that requires `status`. Same props minus
`className` passthrough differences (it forwards `className` too).

| Prop | Type | Default |
|---|---|---|
| `status` | `string` | required |
| `plain` | `boolean` | `false` |
| `children` | `ReactNode` | — |
| …rest | `HTMLAttributes<HTMLSpanElement>` | |

`<StatusChip status="bad">Overdue</StatusChip>`

### Note

Callout strip → `cx-note` with `data-status`; colored inline-start border
(`--st-edge`) on tinted bg (`--st-bg`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `status` | `NoteStatus \| string` | — | `'neutral' \| 'info' \| 'ok' \| 'warn' \| 'bad'` |
| `role` | `string` | `'status'` | ARIA live role |
| `children` | `ReactNode` | — | |
| …rest | `HTMLAttributes<HTMLDivElement>` | | |

| Variant | State | Usage |
|---|---|---|
| neutral | default | `<Note>Generic context</Note>` |
| info / ok / warn / bad | `status` | `<Note status="warn">3 audits pending</Note>` |
| alert | `role="alert"` | `<Note status="bad" role="alert">…` |

### Seg

Segmented radio group → `cx-seg` (`role="radiogroup"`). Visually-hidden
native radios inside `label`s; checked segment gets `--cx-accent-soft`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | `string` | required | Radio group name |
| `value` | `string` | required | Selected option value |
| `onChange` | `(value: string) => void` | required | |
| `options` | `SegOption[]` | required | `{ value, label, disabled? }` |
| `aria-label` / `aria-labelledby` | `string` | — | Group label |
| `required` | `boolean` | — | Passed to radios |
| `className` | `string` | — | |

| Variant | State | Usage |
|---|---|---|
| default | one option checked | `<Seg name="range" value={v} onChange={setV} options={[…]} />` |
| disabled option | `options[i].disabled` | `<SegOption value="x" label="X" disabled />` |

### Toggle

Checkbox-as-toggle → `cx-toggle` label wrapping a visually-hidden
`<input type="checkbox">` + `<span>` label. (The pill-track `.cx-switch`
markup exists in `cx-kit.css` for hand-rolled switches; no ui/ export
emits it — see Legacy mapping.)

| Prop | Type | Default | Notes |
|---|---|---|---|
| `checked` | `boolean` | required | Controlled |
| `onChange` | `(checked: boolean) => void` | required | |
| `name` / `value` | `string` | — | Form attrs |
| `disabled` | `boolean` | `false` | |
| `children` | `ReactNode` | — | Label text |
| `className` | `string` | — | |

| Variant | State | Usage |
|---|---|---|
| off | `checked={false}` | `<Toggle checked={on} onChange={setOn}>Notify</Toggle>` |
| on | `checked={true}` | same |
| disabled | `disabled` | `<Toggle disabled …>` |

### Tabs

Tab strip + panel → `cx-tabs` (`role="tablist"`) with `cx-btn
cx-btn--quiet` tabs; the active tab also gets `cx-btn--primary`. Renders
`role="tabpanel"` for the active `TabItem.panel` only. Full keyboard nav:
ArrowLeft/Right (RTL-aware), Home/End, roving `tabIndex`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `tabs` | `TabItem[]` | required | `{ id, label, panel? }` |
| `value` | `string` | — | Controlled active id |
| `defaultValue` | `string` | first tab | Uncontrolled initial |
| `onChange` | `(id: string) => void` | — | |
| `aria-label` | `string` | — | Tablist label |
| `className` | `string` | — | On the tablist |

| Variant | State | Usage |
|---|---|---|
| default | inactive tab | `<Tabs tabs={[{id:'a',label:'A',panel:<A/>}]} />` |
| active | `aria-selected="true"` | automatic |
| controlled | `value` + `onChange` | `<Tabs value={id} onChange={setId} tabs={…} />` |

### Table (+ parts)

`Table` → `cx-table` (tabular-nums, `.8125rem` base). `TableWrap` →
`cx-tablewrap` (horizontal scroll). `THead`, `TBody`, `TR`, `TH`, `TD` are
thin pass-throughs (plain `className`).

| Export | Element | Class |
|---|---|---|
| `Table` | `<table>` | `cx-table` |
| `TableWrap` | `<div>` | `cx-tablewrap` |
| `THead` / `TBody` / `TR` | `<thead>` / `<tbody>` / `<tr>` | none (pass `className`) |
| `TH` / `TD` | `<th>` / `<td>` | none (pass `className`) |

All accept their standard HTML attributes.

| Variant | State | Usage |
|---|---|---|
| default | header + rows | `<TableWrap><Table><THead><TR><TH>Name</TH>…` |
| row hover | `tbody tr:hover` | automatic (`--cx-surface-sunken`) |
| nowrap | `className="cx-table--nowrap"` on Table | `<Table className="cx-table--nowrap">` |
| numeric col | `className="cx-num-col"` on TH/TD | `<TD className="cx-num-col">{n}</TD>` |
| mono / clip | `cx-mono`, `cx-clip` on TD | long IDs, truncated text |

### Modal

Native `<dialog>` → `className="popup"`. `open` drives
`showModal()`/`close()`; `onCancel` (Esc) and `onClose` are wired. Width is
`min(var(--dialog-s), 100vw - 2rem)`; pair with `.popup-*` content classes
(`popup-body`, `popup-kicker`, `popup-title`, `popup-text`, `popup-note`,
`popup-actions`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `open` | `boolean` | — | Controlled visibility |
| `onClose` | `() => void` | — | Called on Esc/cancel |
| `onCancel` | `(event) => void` | — | Native cancel event |
| `className` | `string` | — | Merges onto `popup` |
| …rest | `DialogHTMLAttributes` | | `aria-labelledby`, etc. |

| Variant | State | Usage |
|---|---|---|
| open | `open={true}` | `<Modal open={open} onClose={close}><div className="popup-body">…` |
| closed | `open={false}` | dialog not shown |
| wide | `className="hm-dialog"` etc. | other styled dialog classes exist (`trk-dialog`, `hm-dialog`) |

### toast

Two exports: `toast(text, tone?)` imperative emitter and `<Toasts />` the
live region (`.toasts`, `role="status"`, `aria-live="polite"`) that must be
mounted once in the shell. Each toast is `.toast toast-{tone}`, auto-expiring
after 4 s.

| Export | Signature | Notes |
|---|---|---|
| `toast` | `(text: string, tone?: string) => void` | Default tone `'ok'` |
| `Toasts` | component, no props | Renders the region |
| `ToastItem` | `{ id: number; text: string; tone: string }` | |

| Tone | Class | Usage |
|---|---|---|
| ok (default) | `toast-ok` | `toast('Saved', 'ok')` |
| warn | `toast-warn` | `toast('Check input', 'warn')` |
| info | `toast-info` | `toast('Synced', 'info')` |
| error / bad | `toast-error` / `toast-bad` | `toast('Failed', 'error')` |

### Skeleton

Re-export of the shell `Skeleton`. Renders `aria-hidden` shimmer blocks
(`.skeleton` + `cc-skel__*`).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `shape` | `'tiles' \| 'ladder' \| 'chart' \| 'rows'` | required | Skeleton layout |
| `n` | `number` | `6` | Item count (tiles/rows) |

| Variant | State | Usage |
|---|---|---|
| tiles | grid of tiles | `<Skeleton shape="tiles" n={4} />` |
| ladder | title + bar + rows | `<Skeleton shape="ladder" />` |
| chart | bar-chart silhouette | `<Skeleton shape="chart" />` |
| rows | title + N rows | `<Skeleton shape="rows" n={3} />` |

### Empty

Empty-state panel → `cx-empty` (dashed border, centered).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | `ReactNode` | required | `<strong>` heading |
| `sub` | `ReactNode` | — | `<p>` subtitle |
| `children` | `ReactNode` | — | Extra content (e.g. a Button) |
| …rest | `HTMLAttributes<HTMLDivElement>` (`title` omitted) | | |

| Variant | State | Usage |
|---|---|---|
| default | title only | `<Empty title="No audits yet" />` |
| with sub | `sub` | `<Empty title="Nothing here" sub="Try widening the filter." />` |
| with action | `children` | `<Empty title="Empty"><Button variant="primary">Create</Button></Empty>` |

## Theming

Appearance is stored as JSON in `localStorage["cx.appearance"]`
(`APPEARANCE_KEY`), shape:

```ts
{ theme: 'auto' | 'light' | 'dark', accent: 'pine' | 'blue' | 'plum' | 'rust',
  solid: boolean, still: boolean, lang: 'en' | 'ar' }
```

Defaults (`APPEARANCE_DEFAULTS`): `auto / pine / false / false / en`.
`applyAppearance()` (`src/features/shared/shell/i18n.ts`) maps it onto
`<html>`:

| Stored field | DOM effect |
|---|---|
| `theme: 'auto'` | `data-theme` removed → `prefers-color-scheme` decides |
| `theme: 'light'/'dark'` | `data-theme="light"/"dark"` |
| `accent: 'pine'` | `data-accent` removed (pine is default) |
| `accent: 'blue'/'plum'/'rust'` | `data-accent="…"` re-pins `--pine*`/`--cx-accent*` |
| `solid` | toggles `data-reduce-transparency` (kills backdrop-filter/glass) |
| `still` | toggles `data-reduce-motion` (zeroes all durations) |
| `lang` | sets `lang` + `dir` (`ar` → `rtl`) |

A boot script in `src/app/layout.tsx` reads `cx.appearance` before paint and
applies `still` + `lang`/`dir` early (anti-FOUC); `data-entry="first"` is
set on `<html>` for entrance staggering. The Appearance UI lives in admin
(`cx-hub/components/admin-page.tsx`); `onAppearanceChange()` notifies
subscribers after each apply. `AppShell` applies stored appearance on app
pages; `SiteChrome` does the same on auth pages.

## A11y contract

- **Focus.** Universal `:focus-visible` → 2 px `--focus` outline +
  `--cx-focus-ring` halo; `forced-colors: active` falls back to
  `Highlight`. `cx-kit.css` re-pins the ring on kit controls
  (`.btn`, `.cx-btn`, `.cx-tab`, `.nav-link`, `.cx-seg label`,
  `.cx-toggle`, `.popup button`, `dialog button`, `.cx-chip`, `summary`, …).
- **Contrast.** Status fg/bg/edge triples and age-ink pairs are authored as
  AA pairs in both themes; accent ink flips per theme (`#ffffff` light,
  dark ink on bright accents).
- **Reduced motion.** `data-reduce-motion` (user setting) or
  `prefers-reduced-motion: reduce` zeroes `--dur-*`, `--cc-*`, `--cx-*`
  durations and kills all transitions/animations. JS checks go through
  `prefersReducedMotion()` (i18n.ts), which honors both.
- **Reduced transparency.** `data-reduce-transparency` or
  `prefers-reduced-transparency` removes `backdrop-filter` and swaps glass
  tokens (`--qg-glass*`) for solid surfaces.
- **RTL.** Logical properties throughout (`inline-*`, `border-inline-*`);
  `dir="rtl"` flips the switch knob, toast entrance, icon flips, and Tabs'
  arrow-key direction. Arabic line-height tokens (`--cx-lh-arabic*`) apply.
- **Touch targets.** `--cx-target` = `2.25rem`, `2.75rem` under
  `pointer: coarse`; re-pinned inside `[data-app]` so per-app sheets can't
  shrink it.
- **Semantics.** `Field` wires `htmlFor`/`aria-describedby`; `Seg` is a
  `radiogroup`; `Tabs` is `tablist`/`tab`/`tabpanel` with roving tabindex;
  `Toasts` is `aria-live="polite"`; `Modal` uses native `<dialog>` top-layer;
  `.skip` skip-link and `.cx-sr`/`.sr-only` utilities exist.
- **Print.** Rail, toasts, banners hidden; panels lose shadows.

### Scene annotation exception

`.eco3-tag` is a projected 3D scene annotation, not a standard action button.
Its `min-height: 0` lets the label hug its content; the rendered annotation
must still meet WCAG's 24px target-size minimum (previous review measured
27.8px). It is exempt from the standard 36px/44px button-density contract,
not from accessible naming, keyboard focus or contrast requirements.

### Shared segmented actions

The retained `.pw-seg` action group is styled in `cx-kit.css`, not a
people-only stylesheet, because hub filters also consume it. New radio
selections should prefer `Seg`.

## Legacy mapping

Old class names still styled by `cx-kit.css` → the ui/ export to reach for
in new code:

| Legacy class(es) | Component |
|---|---|
| `.btn`, `.btn-primary`, `.btn-quiet`, `.btn-danger`, `.btn-small`, `.btn-line` | `Button` (`variant`, `size="sm"`) |
| `.btn.is-busy`, `.spinner` | `Button` + `className="is-busy"` (spinner pseudo-element) |
| `.input`, `textarea.input` | `Input` / `Textarea` |
| `.select` | `Select` |
| `.field`, `.field-label`, `.field-hint`, `.field-error`, `.req` | `Field` (`label`, `hint`, `error`) |
| `.cx-field`, `.cx-field--wide`, `.cx-label`, `.cx-hint`, `.cx-error` | `Field` (same output classes) |
| `.block`, `.block-title`, `.block-text` | `Card pad` + headings (no exact equivalent) |
| `.cx-panel`, `.cx-panel--pad` | `Card` (`pad`) |
| `.cx-section`, `.cx-section__head/__title/__hint`, `.cxp-fold*` | `Section` |
| `.cx-chip`, `.cx-chip--plain` | `Chip` / `StatusChip` |
| `.cx-note` | `Note` |
| `.cx-empty` | `Empty` |
| `.cx-seg` | `Seg` |
| `.cx-toggle` | `Toggle` |
| `.cx-switch`, `.cx-switch__track` | hand-rolled markup only (no ui/ export) |
| `.cx-tabs`, `.cx-tab` | `Tabs` |
| `.cx-table`, `.cx-tablewrap`, `.cx-num-col`, `.cx-mono`, `.cx-clip` | `Table` family + utility classes |
| `dialog.popup`, `.popup-body/-kicker/-title/-text/-note/-actions` | `Modal` + popup content classes |
| `.cx-dialog*` | styled `<dialog>` classes; no ui/ export |
| `.toasts`, `.toast`, `.toast-{ok,warn,info,error,bad}` | `toast()` + `<Toasts />` |
| `.skeleton`, `.cc-skel__*` | `Skeleton` |
| `.cx-grid-2/3`, `.cx-split`, `.cx-dock`, `.cx-filters`, `.cx-filter*` | layout helper classes (no ui/ export) |
| `.cx-agechip`, `.cx-ladder*`, `.cx-dayrail*`, `.cx-need*`, `.cx-agegrid` | domain blocks driven by `data-age`/`data-status` (no ui/ export) |
