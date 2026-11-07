/* eslint-disable @typescript-eslint/no-explicit-any -- parity harness: evaluates foreign minified bundles. */
/**
 * Legacy-side renderer for the extracted `.closure.js` bundles.
 *
 * Each closure file is a self-contained transitive slice of one legacy GAS
 * app's webpack bundle: a bundled preact runtime (h/`e`, hooks, the
 * google.script.run seam) plus every component the page needs — but no DOM
 * renderer (the closures contain zero `document.createElement`/`render`
 * references; the shell owned mounting).
 *
 * This module evaluates a closure inside a vm context with browser stubs,
 * then drives the bundled hooks machinery directly: it sets the bundle's
 * "current component" (`V`) and hook index (`fe`) per invocation, drains the
 * queued `useEffect` records (`__H.__h`) after each pass, lets the
 * script.run stub resolve fixtures, and re-renders until the tree is
 * quiescent — the same multi-pass semantics react-dom would give the port.
 *
 * Internals are discovered per bundle (names are minified differently in each
 * app) by regexing the frozen bundle text:
 *   h      — the vnode factory: last `function <n>(` before `constructor: void 0`
 *   opts   — the options object: `<n>.vnode && <n>.vnode(` inside h
 *   V      — current component: `<n>.__H || (<n>.__H` in the hook-slot getter
 *   fe     — hook index: the `<n>++, <digit>` argument in every hook wrapper
 * The eval epilogue exports `{h, opts, page, env, getV, setV, getFe, setFe}`
 * on `globalThis.__PARITY__`; `env` is a direct-eval escape used to seed
 * module-scoped boot stores (e.g. `Fn`) per page config.
 */
import vm from 'node:vm'
import fs from 'node:fs'
import { Canon, comment, errorNode, hostNode, normText, text } from './canon'

export interface ClosureInternals {
  h: (t: any, n?: any) => any
  opts: Record<string, any>
  page: (props: any) => any
  env: (src: string) => any
  getV: () => any
  setV: (v: any) => void
  getFe: () => number
  setFe: (v: number) => void
}

export interface ClosureLoad {
  internals: ClosureInternals
  calls: { fn: string; args: unknown[] }[]
  unstubbed: { fn: string; args: unknown[] }[]
}

export type GasFixture = { data?: unknown; error?: unknown }

export interface LegacyHarnessOpts {
  pageSymbol: string
  fixtures: (fn: string, args: unknown[]) => GasFixture | undefined
  seeds?: Record<string, unknown>
  contextExtra?: Record<string, unknown>
}

/** Discover the four runtime names in a closure source. */
export function discoverInternals(src: string): { h: string; opts: string; v: string; fe: string } {
  const ctorIdx = src.indexOf('constructor: void 0')
  if (ctorIdx === -1) throw new Error('closure: no vnode factory (constructor: void 0) found')
  const heads = [...src.slice(0, ctorIdx).matchAll(/function (\w+)\s*\(/g)]
  const h = heads.length ? heads[heads.length - 1][1] : ''
  if (!h) throw new Error('closure: could not locate h() factory name')
  const opts = src.match(/(\w+)\.vnode && \1\.vnode\(/)?.[1]
  if (!opts) throw new Error('closure: could not locate options object (<o>.vnode)')
  const v = src.match(/(\w+)\.__H \|\| \(\1\.__H/)?.[1]
  if (!v) throw new Error('closure: could not locate current-component variable (.__H)')
  const feHits = [...src.matchAll(/(\w+)\+\+, \d+\)/g)].map((m) => m[1])
  const fe = feHits.sort((a, b) => feHits.filter((x) => x === b).length - feHits.filter((x) => x === a).length)[0]
  if (!fe) throw new Error('closure: could not locate hook index variable (fe++)')
  return { h, opts, v, fe }
}

/** Browser-global stubs good enough for the closures' module scope + effects. */
function makeSandbox(calls: { fn: string; args: unknown[] }[], unstubbed: { fn: string; args: unknown[] }[], fixtures: LegacyHarnessOpts['fixtures'], extra: Record<string, unknown>) {
  const el = () => ({
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
    innerHTML: '',
    textContent: '',
  })
  const documentStub = {
    documentElement: { lang: 'en', dir: 'ltr', hasAttribute: () => false, setAttribute() {}, classList: { add() {}, remove() {}, contains: () => false } },
    // visible tab: the legacy count-up hook short-circuits on document.hidden
    // while the ported one doesn't — hiding the tab would force divergent output
    hidden: false,
    readyState: 'complete',
    body: el(),
    head: el(),
    createElement: el,
    createTextNode: (t: string) => ({ nodeValue: t }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    title: '',
  }
  const googleRun = () => {
    let ok: ((v: unknown) => void) | undefined
    let fail: ((e: unknown) => void) | undefined
    const self: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, k) {
          if (k === 'withSuccessHandler')
            return (cb: (v: unknown) => void) => {
              ok = cb
              return self
            }
          if (k === 'withFailureHandler')
            return (cb: (e: unknown) => void) => {
              fail = cb
              return self
            }
          if (typeof k === 'string')
            return (...args: unknown[]) => {
              calls.push({ fn: k, args })
              const o = ok
              const f = fail
              queueMicrotask(() => {
                const r = fixtures(k, args)
                if (r === undefined) {
                  unstubbed.push({ fn: k, args })
                  f?.(new Error(`unstubbed google.script.run call: ${k}`))
                } else if (r.error !== undefined) {
                  f?.(r.error instanceof Error ? r.error : new Error(String(r.error)))
                } else {
                  o?.(r.data)
                }
              })
            }
          return undefined
        },
      },
    )
    return self
  }
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    performance,
    requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    fetch: () => Promise.reject(new Error('fetch is not available to legacy bundles')),
    document: documentStub,
    location: { hash: '', search: '', href: 'https://script.google.com/app', pathname: '/', assign() {}, replace() {}, reload() {} },
    history: { pushState() {}, replaceState() {}, back() {}, state: null },
    navigator: { language: 'en', userAgent: 'parity-harness' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    // prefers-reduced-motion: reduce → both count-up hooks render the final
    // value directly; the harness asserts rest states, not animation frames.
    matchMedia: (q: string) => ({ matches: /reduce/.test(String(q)), media: String(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    URLSearchParams,
    URL,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    AbortController,
    FormData,
    Headers,
    IntersectionObserver: undefined,
    MutationObserver: undefined,
    ResizeObserver: undefined,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    google: {
      script: {
        get run() {
          return googleRun()
        },
        url: { getLocation: (cb: (l: { parameter: Record<string, string> }) => void) => cb({ parameter: {} }) },
      },
    },
    alert: () => {},
    confirm: () => true,
    prompt: () => '',
    open: () => null,
    ...extra,
  }
  return sandbox
}

/** Evaluate a closure file and return its exported internals. */
export function loadClosure(file: string, pageSymbol: string, fixtures: LegacyHarnessOpts['fixtures'], seeds: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): ClosureLoad {
  const src = fs.readFileSync(file, 'utf8')
  const names = discoverInternals(src)
  const calls: { fn: string; args: unknown[] }[] = []
  const unstubbed: { fn: string; args: unknown[] }[] = []
  const sandbox = makeSandbox(calls, unstubbed, fixtures, extra)
  const ctx = vm.createContext(sandbox)
  vm.runInContext('this.window = this; this.globalThis = this;', ctx)
  const epilogue = `\n;globalThis.__PARITY__ = {\n  h: ${names.h},\n  opts: ${names.opts},\n  page: ${pageSymbol},\n  env: (s) => eval(s),\n  getV: () => ${names.v},\n  setV: (__p) => { ${names.v} = __p },\n  getFe: () => ${names.fe},\n  setFe: (__p) => { ${names.fe} = __p },\n};`
  // The extractor follows symbol deps only — module-level initializers that
  // are bare ExpressionStatements (like `options = {}`) were dropped. The
  // bundle reads `<opts>.__b` at init, so seed it first (self-assign keeps a
  // real initializer winning when one exists).
  const prologue = `;var ${names.opts} = ${names.opts} || {};`
  vm.runInContext(prologue + src + epilogue, ctx, { filename: file })
  const internals = (ctx as Record<string, any>).__PARITY__ as ClosureInternals
  if (!internals || typeof internals.page !== 'function') throw new Error(`closure ${file}: page symbol ${pageSymbol} not exported`)
  for (const [k, v] of Object.entries(seeds)) internals.env(`${k} = ${JSON.stringify(v)}`)
  return { internals, calls, unstubbed }
}

/* ------------------------------------------------------------------ */
/* Multi-pass vnode renderer driving the bundled hooks machinery.      */
/* ------------------------------------------------------------------ */

interface Comp {
  /** hook cells + kind-3 effect queue (V.__H / x.__H in every bundle) */
  __H: { __: any[]; __h: any[] } | null
  /** kind-4 (afterPaint) effect queue — pushed on the instance itself
   *  (`x.__h.push`); absent in bundles without useAfterPaint */
  __h: any[]
  /** set by the bundled useState impl after first init (qn → x.__f) */
  __f?: boolean
  setState: () => void
}

const isVNode = (v: any): boolean => v && typeof v === 'object' && 'type' in v && 'props' in v

export interface RenderResult {
  tree: Canon
  passes: number
  quiesced: boolean
}

export async function renderLegacy(load: ClosureLoad, routeProps: Record<string, unknown>, maxPasses = 14): Promise<RenderResult> {
  const { internals } = load
  const instances = new Map<string, Comp>()
  let dirty = false
  let effectsRan = false
  let pass = 0

  const mark = () => {
    dirty = true
  }

  const applyPending = (inst: Comp) => {
    const cells = inst.__H?.__
    if (cells) for (const h of cells) if (h && h.__N) { h.__ = h.__N; h.__N = undefined }
  }

  const drainQueue = (arr: any[] | undefined) => {
    if (!arr?.length) return
    for (const entry of arr.splice(0)) {
      try {
        if (typeof entry.__clean === 'function') entry.__clean()
        const c = entry.__()
        if (typeof c === 'function') entry.__clean = c
        if ('u' in entry) entry.__H = entry.u
        effectsRan = true
      } catch {
        /* effect threw — same as a dead effect in-page; surface via state */
      }
    }
  }

  const drain = (inst: Comp) => {
    drainQueue(inst.__h)
    drainQueue(inst.__H?.__h)
  }

  const keyOf = (child: any, i: number, parentKey: string): string =>
    `${parentKey}/${isVNode(child) && child.key != null ? `k${String(child.key)}` : `i${i}`}`

  const walkChildren = (children: any, parentKey: string): Canon[] => {
    const flat: any[] = []
    const push = (c: any) => {
      if (Array.isArray(c)) c.forEach(push)
      else flat.push(c)
    }
    push(children)
    const out: Canon[] = []
    flat.forEach((c, i) => {
      const n = walk(c, keyOf(c, i, parentKey))
      if (n) out.push(n)
    })
    return out
  }

  const walk = (v: any, key: string): Canon | null => {
    if (v == null || v === false || v === true) return null
    if (typeof v === 'string' || typeof v === 'number') {
      const t = normText(v)
      return t ? text(t) : null
    }
    if (Array.isArray(v)) {
      const kids = walkChildren(v, key)
      return kids.length ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids } : null
    }
    if (!isVNode(v)) return comment(String(v))
    const t = v.type
    if (typeof t === 'function') {
      let inst = instances.get(key)
      if (!inst) {
        inst = { __H: null, __h: [], setState: mark }
        instances.set(key, inst)
      }
      applyPending(inst)
      const prevV = internals.getV()
      const prevFe = internals.getFe()
      internals.setV(inst)
      internals.setFe(0)
      let out: any
      try {
        out = t(v.props ?? {})
      } catch (e) {
        out = { __err: e }
      }
      internals.setV(prevV)
      internals.setFe(prevFe)
      if (out && out.__err) return errorNode(out.__err instanceof Error ? out.__err.message : String(out.__err))
      return walk(out, key)
    }
    if (typeof t === 'string') return hostNode(t, v.props ?? {}, walkChildren(v.props?.children, key))
    return walkChildren(v.props?.children, key).length
      ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids: walkChildren(v.props?.children, key) }
      : null
  }

  let tree: Canon = comment('(empty)')
  for (pass = 1; pass <= maxPasses; pass++) {
    dirty = false
    effectsRan = false
    const root = internals.h(internals.page, routeProps)
    tree = walk(root, 'r') ?? comment('(null)')
    for (const inst of instances.values()) drain(inst)
    // let queued microtasks (script.run resolutions, promise .thens) run setState
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()
    if (!dirty && !effectsRan) break
  }
  return { tree, passes: pass, quiesced: pass <= maxPasses && !dirty && !effectsRan }
}
