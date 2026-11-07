/* eslint-disable @typescript-eslint/no-explicit-any -- parity harness: walks two foreign vnode shapes. */
/**
 * Canonical render-tree node — the shape BOTH sides (legacy preact vnode walk
 * and ported React element walk) normalize into, so the differ only ever sees
 * one representation.
 *
 *   tag    — element tag ('div'), '#text', '#comment', '#error'
 *   cls    — sorted, de-duplicated class tokens
 *   attrs  — normalized attribute map (class/style handled separately)
 *   style  — normalized "k:v; k:v" string
 *   text   — text content for #text/#comment/#error
 *   kids   — ordered children
 */
export interface Canon {
  tag: string
  cls: string[]
  attrs: Record<string, string>
  style: string
  text: string
  kids: Canon[]
}

export const text = (s: string): Canon => ({ tag: '#text', cls: [], attrs: {}, style: '', text: s, kids: [] })
export const comment = (s: string): Canon => ({ tag: '#comment', cls: [], attrs: {}, style: '', text: s, kids: [] })
export const errorNode = (s: string): Canon => ({ tag: '#error', cls: [], attrs: {}, style: '', text: s, kids: [] })

/** Whitespace-normalize a text payload the way HTML collation does. */
export const normText = (s: unknown): string => String(s).replace(/\s+/g, ' ')

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

/** Attributes that carry meaning for the parity diff. Handlers/refs/keys drop. */
const KEEP_ATTR = /^(aria-|data-|role$|id$|type$|href$|src$|alt$|title$|scope$|colspan$|rowspan$|value$|checked$|selected$|disabled$|readonly$|required$|placeholder$|min$|max$|step$|name$|for$|target$|rel$|tabindex$|method$|action$|width$|height$|viewbox$|xmlns$|fill$|stroke|stroke-|d$|points$|cx$|cy$|x$|y$|x1$|x2$|y1$|y2$|r$|rx$|ry$|transform$|opacity$|colspan$|headers$|open$|multiple$|size$|maxlength$|minlength$|pattern$|autocomplete$|inputmode$|wrap$|rows$|cols$|lang$|dir$|draggable$|hidden$|download$|media$|sizes$|srcset$|loading$|decoding$|fetchpriority$|poster$|controls$|loop$|muted$|playsinline$|preload$|start$|reversed$|datetime$|cite$|abbr$|span$|ismap$|usemap$|form$|formaction$|formmethod$|formnovalidate$|formtarget$|list$|novalidate$|accept$|accept-charset$|enctype$|autofocus$|contenteditable$|spellcheck$|translate$|slot$|part$|inert$|popover)/i

/** Attributes that are auto-generated ids — values get normalized to '#gen'. */
const GEN_ID_ATTR = new Set(['id', 'for', 'aria-describedby', 'aria-labelledby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'headers', 'list', 'form'])
const GEN_ID_RE = /^[:_]?[rR]\d|^_?[a-zA-Z]{1,2}\d{1,3}[a-z0-9]{2,}.*$|^:r/

const normAttrName = (k: string): string => {
  const n = k === 'className' ? 'class' : k === 'htmlFor' ? 'for' : k === 'readOnly' ? 'readonly' : k === 'tabIndex' ? 'tabindex' : k === 'colSpan' ? 'colspan' : k === 'rowSpan' ? 'rowspan' : k === 'maxLength' ? 'maxlength' : k === 'minLength' ? 'minlength' : k
  return n.toLowerCase()
}

const normStyleName = (k: string): string => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

export function normStyle(style: unknown): string {
  if (style == null || style === '') return ''
  if (typeof style === 'string') return style.trim().replace(/\s+/g, ' ')
  if (typeof style === 'object') {
    const parts: string[] = []
    for (const [k, v] of Object.entries(style as Record<string, unknown>)) {
      if (v == null || v === '') continue
      const kk = k.startsWith('--') ? k : normStyleName(k)
      parts.push(`${kk}:${typeof v === 'number' && !/^(opacity|z-index|font-weight|flex|order|line-height|zoom|scale)/.test(k) ? `${v}px` : String(v)}`)
    }
    return parts.join('; ')
  }
  return String(style)
}

export function splitClass(v: unknown): string[] {
  if (v == null || v === '') return []
  const s = String(v).trim()
  if (!s) return []
  return [...new Set(s.split(/\s+/))].sort()
}

/** Build a host-element Canon from raw props (preact or react shape). */
export function hostNode(tag: string, props: Record<string, any>, kids: Canon[]): Canon {
  const cls = splitClass(props.class ?? props.className)
  const attrs: Record<string, string> = {}
  for (const [rawK, rawV] of Object.entries(props)) {
    if (rawV == null || rawV === false) continue
    const k = normAttrName(rawK)
    if (k === 'class' || k === 'classname' || k === 'style' || k === 'children' || k === 'key' || k === 'ref' || k === 'dangerouslysetinnerhtml') continue
    if (/^on/.test(rawK.toLowerCase()) || /^on[A-Z]/.test(rawK)) continue
    if (!KEEP_ATTR.test(k)) continue
    if (k === 'data-age' || k === 'data-status' || k.startsWith('data-') || k.startsWith('aria-') || true) {
      const v = rawV === true ? 'true' : String(rawV)
      attrs[k] = GEN_ID_ATTR.has(k) && GEN_ID_RE.test(v) ? '#gen' : v
    }
  }
  const style = normStyle(props.style)
  return { tag: tag.toLowerCase(), cls, attrs, style, text: '', kids }
}

/** Signature used for sibling alignment: tag + class tokens. */
export const sigOf = (n: Canon): string => n.tag + '|' + n.cls.join(' ')

export function* walk(n: Canon): Generator<Canon> {
  yield n
  for (const k of n.kids) yield* walk(k)
}

/** All class tokens used anywhere in the tree (with usage counts). */
export function classVocab(root: Canon): Map<string, number> {
  const m = new Map<string, number>()
  for (const n of walk(root)) for (const c of n.cls) m.set(c, (m.get(c) ?? 0) + 1)
  return m
}

export interface CopyLine {
  text: string
  a11y: boolean // inside .sr-only / aria-hidden subtree
  path: string
}

/** Ordered visible text nodes; a11y-flagged when under sr-only/aria-hidden. */
export function copyLines(root: Canon): CopyLine[] {
  const out: CopyLine[] = []
  const go = (n: Canon, a11y: boolean, path: string) => {
    const here = a11y || n.cls.includes('sr-only') || n.attrs['aria-hidden'] === 'true'
    if (n.tag === '#text') {
      const t = normText(n.text).trim()
      if (t) out.push({ text: t, a11y: here, path })
    }
    n.kids.forEach((k, i) => go(k, here, `${path}/${i}`))
  }
  go(root, false, '')
  return out
}

/** Serialize a Canon tree to indented HTML for the human report. */
export function toHtml(n: Canon, depth = 0): string {
  const pad = '  '.repeat(depth)
  if (n.tag === '#text') return pad + esc(n.text)
  if (n.tag === '#comment') return `${pad}<!--${n.text}-->`
  if (n.tag === '#error') return `${pad}<!-- RENDER ERROR: ${esc(n.text)} -->`
  const cls = n.cls.length ? ` class="${n.cls.join(' ')}"` : ''
  const attrs = Object.keys(n.attrs)
    .sort()
    .map((k) => ` ${k}="${esc(n.attrs[k])}"`)
    .join('')
  const style = n.style ? ` style="${esc(n.style)}"` : ''
  if (VOID.has(n.tag) && !n.kids.length) return `${pad}<${n.tag}${cls}${attrs}${style} />`
  const inner = n.kids.map((k) => toHtml(k, depth + 1)).join('\n')
  return `${pad}<${n.tag}${cls}${attrs}${style}>\n${inner}\n${pad}</${n.tag}>`
}

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Structural normalization applied to BOTH trees before diffing:
 *   - transparent `#frag` wrappers are flattened into the parent
 *   - adjacent `#text` siblings are concatenated into one node
 *
 * JSX whitespace rules split text children differently than the legacy
 * bundle's pre-compiled string literals (`" done "` vs `" done" + {' '} + …`).
 * The rendered text stream is identical — only vnode boundaries moved — so
 * the merge makes the diff compare copy, not compiler segmentation.
 */
export function normalizeTree(n: Canon): Canon {
  const kids: Canon[] = []
  for (const k of n.kids) {
    const nk = normalizeTree(k)
    if (nk.tag === '#frag') kids.push(...nk.kids)
    else kids.push(nk)
  }
  const merged: Canon[] = []
  for (const k of kids) {
    const prev = merged[merged.length - 1]
    if (k.tag === '#text' && prev?.tag === '#text') prev.text += k.text
    else merged.push(k)
  }
  return { ...n, kids: merged }
}
