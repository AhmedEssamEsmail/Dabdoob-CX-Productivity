/* eslint-disable @typescript-eslint/no-explicit-any -- parity harness: walks foreign React element trees. */
/**
 * Port-side renderer: a component-AST walk of the real TSX pages, without a
 * DOM. React's hooks dispatcher (`React.__CLIENT_INTERNALS_*.H`) is swapped
 * for a minimal one implementing the hooks the verbatim ports use
 * (state/effect/memo/callback/ref/id/context/external-store/transition).
 *
 * Like the legacy driver: render the page element, drain queued effects, let
 * the `fetch` stub resolve fixtures into state, re-render until quiescent.
 * Component hook cells persist across passes keyed by tree path
 * (key-or-index), matching the legacy driver's component-instance map.
 */
import * as React from 'react'
import { Canon, comment, errorNode, hostNode, normText, text } from './canon'

const ELEMENTS = new Set([Symbol.for('react.element'), Symbol.for('react.transitional.element')])
const FRAGMENT = Symbol.for('react.fragment')
const CONTEXT = Symbol.for('react.context')
const CONSUMER = Symbol.for('react.consumer')
const PROVIDER = Symbol.for('react.provider')
const MEMO = Symbol.for('react.memo')
const FORWARD_REF = Symbol.for('react.forward_ref')
const LAZY = Symbol.for('react.lazy')
const SUSPENSE = Symbol.for('react.suspense')
const PROFILER = Symbol.for('react.profiler')
const STRICT_MODE = Symbol.for('react.strict_mode')

interface Cell {
  v?: any
  d?: any[] | undefined
  q?: any[]
  pend?: (() => void | (() => void)) | undefined
  clean?: (() => void) | undefined
}

interface RComp {
  cells: Cell[]
  idx: number
  path: string
}

export interface PortRenderOpts {
  maxPasses?: number
}

const sameDeps = (a: any[] | undefined, b: any[] | undefined): boolean => {
  if (a === undefined || b === undefined) return false
  if (a.length !== b.length) return false
  return a.every((x, i) => Object.is(x, b[i]))
}

export async function renderPort(el: any, opts: PortRenderOpts = {}): Promise<{ tree: Canon; passes: number; quiesced: boolean }> {
  const maxPasses = opts.maxPasses ?? 14
  const instances = new Map<string, RComp>()
  const effectQueue: Cell[] = []
  let dirty = false
  let effectsRan = false

  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  if (!internals || !('H' in internals)) throw new Error('react client internals .H not found — dispatcher seam changed')
  const prevH = internals.H

  const stack: RComp[] = []
  const cur = (): RComp => {
    const c = stack[stack.length - 1]
    if (!c) throw new Error('hook called outside a parity component render')
    return c
  }
  const nextCell = (): Cell => {
    const c = cur()
    const i = c.idx++
    return (c.cells[i] ??= {})
  }
  const makeUpdater = (cell: Cell, reducer?: (v: any, u: any) => any) => (u: any) => {
    ;(cell.q ??= []).push(reducer ? (v: any) => reducer(v, u) : u)
    dirty = true
  }

  const dispatcher = {
    useState(init: any) {
      const cell = nextCell()
      if (!('v' in cell)) cell.v = typeof init === 'function' ? init() : init
      return [cell.v, makeUpdater(cell)]
    },
    useReducer(reducer: (v: any, a: any) => any, init: any, lazy?: (v: any) => any) {
      const cell = nextCell()
      if (!('v' in cell)) cell.v = lazy ? lazy(init) : init
      return [cell.v, makeUpdater(cell, reducer)]
    },
    useEffect(cb: () => void | (() => void), deps?: any[]) {
      const cell = nextCell()
      if (!sameDeps(cell.d, deps)) {
        cell.d = deps
        cell.pend = cb
        effectQueue.push(cell)
      }
    },
    useLayoutEffect(cb: () => void | (() => void), deps?: any[]) {
      const cell = nextCell()
      if (!sameDeps(cell.d, deps)) {
        cell.d = deps
        cell.pend = cb
        effectQueue.push(cell)
      }
    },
    useInsertionEffect() {},
    useMemo(fn: () => any, deps?: any[]) {
      const cell = nextCell()
      if (!('d' in cell) || !sameDeps(cell.d, deps)) {
        cell.v = fn()
        cell.d = deps
      }
      return cell.v
    },
    useCallback(fn: any, deps?: any[]) {
      const cell = nextCell()
      if (!('d' in cell) || !sameDeps(cell.d, deps)) {
        cell.v = fn
        cell.d = deps
      }
      return cell.v
    },
    useRef(init: any) {
      const cell = nextCell()
      if (!('v' in cell)) cell.v = { current: init }
      return cell.v
    },
    useId() {
      const c = cur()
      return `p${c.path.replace(/[^\w]/g, '')}:r${c.idx - 1}`
    },
    useContext(ctx: any) {
      return ctx && typeof ctx === 'object' ? ctx._currentValue : undefined
    },
    useSyncExternalStore(_sub: any, get: () => any) {
      return get()
    },
    useTransition() {
      return [false, (cb: () => void) => cb()]
    },
    useDeferredValue(v: any) {
      return v
    },
    useOptimistic(v: any) {
      return [v, () => {}]
    },
    useActionState(_fn: any, init: any) {
      return [init, () => {}, false]
    },
    useImperativeHandle() {},
    useDebugValue() {},
    useFormStatus() {
      return { pending: false, data: null, method: null, action: null }
    },
    useHostTransitionStatus() {
      return null
    },
    useMemoCache(size: number) {
      const c = cur()
      const cell = c.cells[c.idx] ?? (c.cells[c.idx] = {})
      c.idx++
      if (!cell.v) cell.v = new Array(size)
      return cell.v
    },
    use(x: any) {
      if (x && typeof x === 'object' && '_currentValue' in x) return x._currentValue
      throw new Error('parity dispatcher: use() of a non-context (promise) is not supported')
    },
  }

  const applyQueued = (inst: RComp) => {
    for (const cell of inst.cells) {
      if (cell?.q) {
        cell.v = cell.q.reduce((v: any, u: any) => (typeof u === 'function' ? u(v) : u), cell.v)
        cell.q = undefined
      }
    }
  }

  const keyOf = (child: any, i: number, parentKey: string): string => {
    const k = child && typeof child === 'object' && child.key != null ? `k${String(child.key)}` : `i${i}`
    return `${parentKey}/${k}`
  }

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

  const walkComponent = (node: any, fn: (p: any) => any, props: any, key: string, label: string): Canon | null => {
    const id = `${key}:${label}`
    let inst = instances.get(id)
    if (!inst) {
      inst = { cells: [], idx: 0, path: id }
      instances.set(id, inst)
    }
    inst.idx = 0
    applyQueued(inst)
    stack.push(inst)
    let out: any
    try {
      out = fn(props)
    } catch (e) {
      out = { __err: e }
    }
    stack.pop()
    if (out && out.__err) return errorNode(out.__err instanceof Error ? out.__err.message : String(out.__err))
    return walk(out, key)
  }

  const walk = (node: any, key: string): Canon | null => {
    if (node == null || node === false || node === true) return null
    if (typeof node === 'string' || typeof node === 'number') {
      const t = normText(node)
      return t ? text(t) : null
    }
    if (Array.isArray(node)) {
      const kids = walkChildren(node, key)
      return kids.length ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids } : null
    }
    if (typeof node === 'object' && !(node as any).$$typeof && typeof (node as any)[Symbol.iterator] === 'function') {
      const kids = walkChildren([...(node as any)], key)
      return kids.length ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids } : null
    }
    if (typeof node !== 'object' || !ELEMENTS.has(node.$$typeof)) return comment(typeof node === 'object' ? JSON.stringify(node).slice(0, 120) : String(node))
    const t = node.type
    const props = node.props ?? {}
    if (t === FRAGMENT) {
      const kids = walkChildren(props.children, key)
      return kids.length ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids } : null
    }
    if (t === SUSPENSE || t === PROFILER || t === STRICT_MODE) {
      const kids = walkChildren(props.children, key)
      return kids.length ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids } : null
    }
    if (typeof t === 'function') return walkComponent(node, t, props, key, t.name || 'fn')
    if (typeof t === 'string') return hostNode(t, props, walkChildren(props.children, key))
    if (t && typeof t === 'object') {
      const tt = (t as any).$$typeof
      if (tt === MEMO) return walkComponent(node, (t as any).type, props, key, (t as any).type?.name || 'memo')
      if (tt === FORWARD_REF) return walkComponent(node, (p: any) => (t as any).render(p, node.ref), props, key, (t as any).render?.name || 'forwardRef')
      if (tt === CONTEXT || tt === PROVIDER) {
        const ctx = tt === PROVIDER ? (t as any)._context ?? t : t
        const prev = ctx._currentValue
        ctx._currentValue = props.value
        const kids = walkChildren(props.children, key)
        ctx._currentValue = prev
        return kids.length ? { tag: '#frag', cls: [], attrs: {}, style: '', text: '', kids } : null
      }
      if (tt === CONSUMER) {
        const ctx = (t as any)._context ?? t
        return walk(props.children ? props.children(ctx._currentValue) : null, key)
      }
      if (tt === LAZY) {
        const payload = (t as any)._payload
        const init = (t as any)._init
        const resolved = payload && payload._status === 1 ? payload._result : init ? init(payload) : null
        if (resolved) return walk({ ...node, type: resolved.default ?? resolved }, key)
        return comment('lazy(unresolved)')
      }
    }
    return comment(`unknown-type:${String(t)}`)
  }

  internals.H = dispatcher
  let pass = 0
  let tree: Canon = comment('(empty)')
  try {
    for (pass = 1; pass <= maxPasses; pass++) {
      dirty = false
      effectsRan = false
      tree = walk(el, 'r') ?? comment('(null)')
      let c: Cell | undefined
      while ((c = effectQueue.shift())) {
        try {
          if (typeof c.clean === 'function') c.clean()
          const r = c.pend?.()
          if (typeof r === 'function') c.clean = r
          c.pend = undefined
          effectsRan = true
        } catch {
          /* a throwing effect is a page bug, not a harness bug — keep diffing */
        }
      }
      await new Promise((r) => setTimeout(r, 0))
      await Promise.resolve()
      if (!dirty && !effectsRan) break
    }
  } finally {
    internals.H = prevH
  }
  return { tree, passes: pass, quiesced: pass <= maxPasses && !dirty && !effectsRan }
}
