/* eslint-disable @typescript-eslint/no-explicit-any -- parity harness. */
/**
 * DOM/class-diff parity harness (WP-45, option a).
 *
 * For each configured page it renders BOTH sides to the same canonical AST:
 *   legacy — the extracted `.closure.js` bundle evaluated in a vm with
 *            browser stubs; the bundled preact hooks machinery is driven
 *            directly (V/fe set per component, __H.__h effects drained,
 *            google.script.run resolved from fixtures) until quiescent.
 *   port   — the real TSX page component walked as a React element tree with
 *            a custom hooks dispatcher (internals.H); fetch() resolves the
 *            same fixtures until quiescent.
 *
 * Then it diffs class vocabulary, copy (visible + a11y), element order and
 * attributes, and writes a per-page report under
 * specs/megaplan/audits/parity/<page>.md plus a JSON roll-up.
 *
 *   npx tsx scripts/parity/run.ts [--page qa-forms] [--html]
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadClosure, renderLegacy } from './legacy'
import { renderPort } from './port'
import { diffTrees, stats } from './diff'
import { normalizeTree, toHtml, type Canon } from './canon'
import { PAGES, type PageCfg } from './pages'
import { BOOT, fixturesFor } from './fixtures'

const ROOT = path.resolve(__dirname, '..', '..')
const EXTRACT = path.join(ROOT, '.devin', 'work', 'extract')
const OUT_DIR = path.join(ROOT, 'specs', 'megaplan', 'audits', 'parity')
const WANT_HTML = process.argv.includes('--html')
const ONLY = (() => {
  const i = process.argv.indexOf('--page')
  return i === -1 ? null : process.argv[i + 1]
})()

/* ---------------- browser stubs for the port side ---------------- */

const fakeEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
  setAttribute() {},
  getAttribute: () => null,
  appendChild: (c: unknown) => c,
  removeChild: (c: unknown) => c,
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
  scrollIntoView() {},
  focus() {},
  click() {},
  remove() {},
  children: [],
})
;(globalThis as any).document ??= {
  documentElement: { lang: 'en', dir: 'ltr', hasAttribute: () => false, setAttribute() {}, classList: { add() {}, remove() {}, contains: () => false } },
  hidden: false,
  readyState: 'complete',
  body: fakeEl(),
  head: fakeEl(),
  createElement: fakeEl,
  createTextNode: (t: string) => ({ nodeValue: t }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
}
;(globalThis as any).location ??= { hash: '', search: '', href: 'http://localhost/', pathname: '/', assign() {}, replace() {}, reload() {} }
;(globalThis as any).matchMedia ??= (q: string) => ({ matches: /reduce/.test(String(q)), media: String(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
;(globalThis as any).requestAnimationFrame ??= (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0)
;(globalThis as any).cancelAnimationFrame ??= (id: number) => clearTimeout(id)
;(globalThis as any).window ??= globalThis
;(globalThis as any).addEventListener ??= () => {}
;(globalThis as any).removeEventListener ??= () => {}

/* ---------------- fetch stub ---------------- */

interface PageRun {
  cfg: PageCfg
  legacyTree: Canon | null
  portTree: Canon | null
  legacyCalls: { fn: string; args: unknown[] }[]
  legacyUnstubbed: { fn: string; args: unknown[] }[]
  portCalls: string[]
  portUnstubbed: string[]
  passes: { legacy: number; port: number }
  quiesced: { legacy: boolean; port: boolean }
  error?: string
}

async function runPage(cfg: PageCfg): Promise<PageRun> {
  const fx = fixturesFor(cfg.key)
  const run: PageRun = {
    cfg,
    legacyTree: null,
    portTree: null,
    legacyCalls: [],
    legacyUnstubbed: [],
    portCalls: [],
    portUnstubbed: [],
    passes: { legacy: 0, port: 0 },
    quiesced: { legacy: false, port: false },
  }

  // ---- legacy side
  const closurePath = path.join(EXTRACT, cfg.closureFile)
  const load = loadClosure(closurePath, cfg.pageSymbol, fx.gas, cfg.seeds)
  run.legacyCalls = load.calls
  run.legacyUnstubbed = load.unstubbed
  const leg = await renderLegacy(load, cfg.routeProps)
  run.legacyTree = normalizeTree(leg.tree)
  run.passes.legacy = leg.passes
  run.quiesced.legacy = leg.quiesced

  // ---- port side
  const prevFetch = globalThis.fetch
  globalThis.fetch = (async (url: any, init: any) => {
    const method = init?.method ?? 'GET'
    let body: unknown
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined
    } catch {
      body = undefined
    }
    run.portCalls.push(`${method} ${String(url)}`)
    const data = fx.api(method, String(url), body)
    const isErr = data && typeof data === 'object' && 'error' in (data as Record<string, unknown>) && Object.keys(data as object).length === 1
    if (isErr) run.portUnstubbed.push(`${method} ${String(url)}`)
    return {
      ok: !isErr,
      status: isErr ? 500 : 200,
      statusText: isErr ? 'Internal Server Error' : 'OK',
      json: async () => data,
      text: async () => JSON.stringify(data),
      headers: { get: () => null },
    } as unknown as Response
  }) as typeof fetch
  try {
    const { setBoot } = await import('../../src/features/shared/shell/context')
    setBoot(BOOT as any)
    const mod = await import(`../../src/features/${cfg.portModule}.tsx`).catch(() => import(`../../src/features/${cfg.portModule}`))
    const Comp = cfg.portExport === 'default' ? mod.default : mod[cfg.portExport]
    if (typeof Comp !== 'function') throw new Error(`port component ${cfg.portModule}:${cfg.portExport} not a function`)
    const React = await import('react')
    const el = React.createElement(Comp as any, cfg.routeProps)
    const pr = await renderPort(el)
    run.portTree = normalizeTree(pr.tree)
    run.passes.port = pr.passes
    run.quiesced.port = pr.quiesced
  } finally {
    globalThis.fetch = prevFetch
  }
  return run
}

/* ---------------- report ---------------- */

function mdReport(run: PageRun, diff: ReturnType<typeof diffTrees> | null): string {
  const { cfg } = run
  const l: string[] = []
  l.push(`# Parity report — ${cfg.key}`)
  l.push('')
  l.push(`- legacy: \`.devin/work/extract/${cfg.closureFile}\` (page symbol \`${cfg.pageSymbol}\`)`)
  l.push(`- port: \`src/features/${cfg.portModule}\` (\`${cfg.portExport}\`)`)
  l.push(`- scenario: ${cfg.scenario}`)
  l.push('')
  if (run.error) {
    l.push(`**HARNESS ERROR:** ${run.error}`)
    return l.join('\n')
  }
  const ls = run.legacyTree ? stats(run.legacyTree) : null
  const ps = run.portTree ? stats(run.portTree) : null
  l.push('| side | passes | quiesced | nodes | text nodes | class tokens |')
  l.push('|---|---|---|---|---|---|')
  l.push(`| legacy | ${run.passes.legacy} | ${run.quiesced.legacy} | ${ls?.nodes ?? 0} | ${ls?.texts ?? 0} | ${ls?.classes ?? 0} |`)
  l.push(`| port | ${run.passes.port} | ${run.quiesced.port} | ${ps?.nodes ?? 0} | ${ps?.texts ?? 0} | ${ps?.classes ?? 0} |`)
  l.push('')
  if (!diff) {
    l.push('_no diff — a side failed to render_')
    return l.join('\n')
  }
  l.push(`## Verdict: ${diff.clean ? '**MATCH** — no divergence on any axis' : '**DIVERGED**'}`)
  l.push('')
  const sect = (title: string, lines: string[], empty = 'none') => {
    l.push(`### ${title} (${lines.length})`)
    l.push('')
    if (!lines.length) l.push(`_${empty}_`)
    else for (const x of lines) l.push(`- ${x}`)
    l.push('')
  }
  sect(
    'Classes only in legacy',
    diff.classes.onlyLegacy.map(([c, n]) => `\`${c}\` ×${n}`),
  )
  sect(
    'Classes only in port',
    diff.classes.onlyPort.map(([c, n]) => `\`${c}\` ×${n}`),
  )
  sect(
    'Copy only in legacy',
    diff.copy.onlyLegacy.map((c) => `${c.a11y ? '(a11y) ' : ''}${JSON.stringify(c.text)}`),
  )
  sect(
    'Copy only in port',
    diff.copy.onlyPort.map((c) => `${c.a11y ? '(a11y) ' : ''}${JSON.stringify(c.text)}`),
  )
  sect('Render errors', diff.errors)
  sect('Structure (element add/remove/reorder)', diff.structure)
  sect('Attribute diffs', diff.attrs)
  sect('Text diffs (matched position)', diff.texts)
  if (run.legacyUnstubbed.length || run.portUnstubbed.length) {
    l.push('### Unstubbed calls')
    l.push('')
    for (const c of run.legacyUnstubbed) l.push(`- legacy gas: \`${c.fn}\``)
    for (const c of run.portUnstubbed) l.push(`- port fetch: \`${c}\``)
    l.push('')
  }
  l.push('### Calls made')
  l.push('')
  l.push(`- legacy gas: ${run.legacyCalls.map((c) => `\`${c.fn}\``).join(', ') || 'none'}`)
  l.push(`- port fetch: ${run.portCalls.map((c) => `\`${c}\``).join(', ') || 'none'}`)
  l.push('')
  if (WANT_HTML && run.legacyTree && run.portTree) {
    l.push('<details><summary>legacy render (normalized)</summary>')
    l.push('')
    l.push('```html')
    l.push(toHtml(run.legacyTree))
    l.push('```')
    l.push('</details>')
    l.push('')
    l.push('<details><summary>port render (normalized)</summary>')
    l.push('')
    l.push('```html')
    l.push(toHtml(run.portTree))
    l.push('```')
    l.push('</details>')
  }
  return l.join('\n')
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pages = ONLY ? PAGES.filter((p) => p.key === ONLY) : PAGES
  if (!pages.length) throw new Error(`no page config matched --page ${ONLY}`)
  const summary: Record<string, unknown>[] = []
  for (const cfg of pages) {
    process.stderr.write(`[parity] ${cfg.key} … `)
    let run: PageRun
    let diff: ReturnType<typeof diffTrees> | null = null
    try {
      run = await runPage(cfg)
      if (run.legacyTree && run.portTree) diff = diffTrees(run.legacyTree, run.portTree)
    } catch (e) {
      run = {
        cfg,
        legacyTree: null,
        portTree: null,
        legacyCalls: [],
        legacyUnstubbed: [],
        portCalls: [],
        portUnstubbed: [],
        passes: { legacy: 0, port: 0 },
        quiesced: { legacy: false, port: false },
        error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e),
      }
    }
    const md = mdReport(run, diff)
    fs.writeFileSync(path.join(OUT_DIR, `${cfg.key}.md`), md + '\n')
    const verdict = run.error ? 'HARNESS-ERROR' : diff ? (diff.clean ? 'MATCH' : `DIVERGED(${diff.errors.length + diff.structure.length + diff.attrs.length + diff.texts.length + diff.copy.onlyLegacy.length + diff.copy.onlyPort.length + diff.classes.onlyLegacy.length + diff.classes.onlyPort.length})`) : 'NO-RENDER'
    process.stderr.write(`${verdict}\n`)
    summary.push({
      page: cfg.key,
      verdict,
      quiesced: run.quiesced,
      passes: run.passes,
      diff: diff
        ? {
            classesOnlyLegacy: diff.classes.onlyLegacy.length,
            classesOnlyPort: diff.classes.onlyPort.length,
            copyOnlyLegacy: diff.copy.onlyLegacy.length,
            copyOnlyPort: diff.copy.onlyPort.length,
            structure: diff.structure.length,
            attrs: diff.attrs.length,
            texts: diff.texts.length,
            errors: diff.errors.length,
          }
        : null,
      error: run.error ?? null,
    })
  }
  fs.writeFileSync(path.join(OUT_DIR, 'parity-report.json'), JSON.stringify({ generated: new Date().toISOString(), pages: summary }, null, 2))
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) main().catch((e) => (console.error(e), process.exit(1)))

export { runPage }
