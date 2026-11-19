/**
 * Regression test — holform-overlap-sweep (specs/holform-overlap-sweep/reports/debug-1.md)
 *
 * Bug class: a grid/flex row hosts .field/.cx-field/input/select/textarea next to
 * buttons. Grid tracks sized minmax(0,…) (or fixed tracks < the control's intrinsic
 * minimum, ~10rem for a default size=20 input) let the track shrink below the
 * control's min-content. .field/.cx-field carry min-width:0 (cx-kit.css:251) so the
 * wrapper shrinks, but .input/.select/.cx-input/.cx-select have width:100% and NO
 * min-inline-size:0 (cx-kit.css:275-291) — so the control overflows its cell and the
 * next cell's opaque control/button paints over it.
 *
 * Canonical fix (quality.css:144 convention): a scoped guard
 *   <row> :is(input:not([type=checkbox]):not([type=radio]),select,textarea) {
 *     box-sizing:border-box; min-inline-size:0; max-inline-size:100%;
 *   }
 * …or bounded minmax(<min>,…) tracks with <min> >= 10rem on every column.
 *
 * FAILS until every site in SITES is fixed.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const css = (rel: string) => readFileSync(path.join(root, rel), 'utf8')
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SAFE_MIN_REM = 10 // ~ min-content of a default text/datetime control

/** length token -> rem, or NaN for non-lengths (fr, %, var(), auto…) */
function toRem(v: string): number {
  const t = v.trim()
  if (/^-?[\d.]+px$/i.test(t)) return parseFloat(t) / 16
  if (/^-?[\d.]+(rem|em)$/i.test(t)) return parseFloat(t)
  if (/^0$/.test(t)) return 0
  return NaN
}

/** split a track list on top-level whitespace (paren-aware) */
function splitTracks(tpl: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of tpl.trim()) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** true when every track has a safe minimum (>=10rem, or content-bounded) */
function tracksBounded(tpl: string): boolean {
  for (let tok of splitTracks(tpl)) {
    const rep = tok.match(/^repeat\((?:\d+|auto-fit|auto-fill),\s*(.+)\)$/i)
    if (rep) tok = rep[1].trim()
    const mm = tok.match(/^minmax\(\s*([^,]+),/i)
    if (mm) {
      let min = mm[1].trim()
      const minFn = min.match(/^min\((.+)\)$/i)
      if (minFn) {
        // min(100%,20rem) -> evaluate the non-% argument
        const cand = minFn[1].split(',').map((s) => s.trim()).filter((s) => !s.endsWith('%'))
        min = cand[0] ?? '0'
      }
      if (/^(auto|min-content|max-content|fit-content)/i.test(min)) continue // content-bounded
      const rem = toRem(min)
      if (Number.isNaN(rem) || rem < SAFE_MIN_REM) return false
      continue
    }
    if (/^(auto|min-content|max-content|fit-content)/i.test(tok)) continue
    if (/^[\d.]+fr$/i.test(tok)) continue // 1fr == minmax(auto,1fr): auto min
    const rem = toRem(tok)
    if (Number.isNaN(rem) || rem < SAFE_MIN_REM) return false // fixed track too small / var()
  }
  return true
}

/** rule <sel-ish> :is(input…){…min-inline-size|min-width:0…} scoped under the last class token */
function hasControlGuard(cssText: string, sel: string): boolean {
  const tok = sel.trim().split(/\s+/).pop()!
  const rx = new RegExp(
    esc(tok) +
      String.raw`(?:\s*:is\([^}]*\)|[^{}]*?(?:input|select|textarea)[^{}]*?)\s*\{[^{}]*?min-(?:inline-size|width)\s*:\s*0`,
    'i'
  )
  return rx.test(cssText)
}

/** every grid-template-columns declared on rules whose selector mentions tok */
function gridDecls(cssText: string, sel: string): string[] {
  const tok = sel.trim().split(/\s+/).pop()!
  const rx = new RegExp(`[^{}]*${esc(tok)}[^{}]*\\{([^{}]*)\\}`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = rx.exec(cssText))) {
    const d = m[1].match(/grid-template-columns\s*:\s*([^;}]+)/)
    if (d) out.push(d[1])
  }
  return out
}

function siteOk(cssText: string, sel: string): boolean {
  if (hasControlGuard(cssText, sel)) return true
  const decls = gridDecls(cssText, sel)
  return decls.length > 0 && decls.every(tracksBounded)
}

// ---- broken sites (must FAIL until fixed) -------------------------------
const SITES: Array<{ file: string; sel: string; where: string }> = [
  { file: 'src/app/refresh.css', sel: '.dq-holform', where: 'people-holidays add-form (repeat(3,minmax(0,1fr)) auto)' },
  { file: 'src/app/refresh.css', sel: '.dq-editor', where: 'inline person editor (repeat(2,minmax(0,1fr)))' },
  { file: 'src/app/refresh.css', sel: '.page-actions', where: 'unified page-actions row' },
  { file: 'src/app/styles/people.css', sel: '.pw-new-action', where: '1:1/meeting action rows' },
  { file: 'src/app/styles/people.css', sel: '.oo-proj-grid', where: 'project field grid (9rem < control min)' },
  { file: 'src/app/styles/people.css', sel: '.pw-inline', where: 'flex rows: .field items + buttons' },
  { file: 'src/app/styles/quality.css', sel: '.qa-bq', where: 'question builder row (5.5rem < input min)' },
  { file: 'src/app/styles/queue.css', sel: '.sch-edit-row', where: 'scheduler flex rows (.field min-width:0)' },
  { file: 'src/app/styles/operations.css', sel: '.trk-dep-row', where: 'dependent-choice input row' },
  { file: 'src/app/styles/productivity.css', sel: '.tph-taskform', where: 'log-task flex form (9rem-bound fields < select min)' },
  { file: 'src/app/styles/desk.css', sel: '.dk-otd__grid', where: 'OTD entry grid (110px < input min)' },
  { file: 'src/app/cx-kit.css', sel: '.cx-filters', where: 'filter bar labels (11rem/16rem < select min)' },
  { file: 'src/app/cx-kit.css', sel: '.cx-queuerow', where: 'check-in fieldset (7.5-12rem tracks < textarea min)' },
]

// ---- guarded exemplars (must stay passing) ------------------------------
const ANCHORS: Array<{ file: string; sel: string }> = [
  { file: 'src/app/styles/quality.css', sel: '.qa-pass' },
  { file: 'src/app/styles/quality.css', sel: '.qa-grid' },
  { file: 'src/app/styles/quality.css', sel: '.qa-request' },
  { file: 'src/app/styles/quality.css', sel: '.qa-ctlform' },
  { file: 'src/app/styles/quality.css', sel: '.qa-details-panel' },
  { file: 'src/app/styles/people.css', sel: '.oo-period-custom' },
  { file: 'src/app/styles/queue.css', sel: '.hm-num' },
  { file: 'src/app/styles/hub.css', sel: '.setting-edit' },
  { file: 'src/app/cx-kit.css', sel: '.cx-settings-section' },
]

describe('form-row control shrink guard (holform-overlap-sweep)', () => {
  for (const s of SITES) {
    it(`${s.sel} keeps controls inside their track (${s.where})`, () => {
      expect(siteOk(css(s.file), s.sel), `${s.file} ${s.sel}: add a scoped min-inline-size:0 control guard or bound tracks >= ${SAFE_MIN_REM}rem`).toBe(true)
    })
  }
  for (const s of ANCHORS) {
    it(`${s.sel} stays guarded`, () => {
      expect(siteOk(css(s.file), s.sel)).toBe(true)
    })
  }
})
