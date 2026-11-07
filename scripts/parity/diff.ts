 
/**
 * Three-axis tree diff over the canonical AST:
 *   1. class vocabulary — set diff of every class token used (with counts)
 *   2. copy — ordered text-node sequence diff (visible vs a11y channels)
 *   3. element order / structure — recursive sibling-sequence alignment
 *      (LCS on tag+class signature) reporting missing/extra nodes,
 *      per-node class diffs, attribute diffs and text diffs in place.
 */
import { Canon, classVocab, copyLines, sigOf, walk } from './canon'

export interface DiffReport {
  classes: { onlyLegacy: [string, number][]; onlyPort: [string, number][] }
  copy: { onlyLegacy: { text: string; a11y: boolean }[]; onlyPort: { text: string; a11y: boolean }[] }
  structure: string[]
  attrs: string[]
  texts: string[]
  /** Render errors found inside the trees — always a divergence, even when
   *  both sides fail identically (a shared `#error` must never be a MATCH). */
  errors: string[]
  clean: boolean
}

/** LCS alignment of two sibling lists by signature; returns matched pairs. */
function align(a: Canon[], b: Canon[]): { pairs: [number, number][]; aOnly: number[]; bOnly: number[] } {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = sigOf(a[i]) === sigOf(b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const pairs: [number, number][] = []
  const aOnly: number[] = []
  const bOnly: number[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (sigOf(a[i]) === sigOf(b[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
      pairs.push([i, j])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      aOnly.push(i)
      i++
    } else {
      bOnly.push(j)
      j++
    }
  }
  while (i < n) aOnly.push(i++)
  while (j < m) bOnly.push(j++)
  return { pairs, aOnly, bOnly }
}

const brief = (n: Canon, depth = 0): string => {
  const cls = n.cls.length ? '.' + n.cls.join('.') : ''
  const t = n.tag === '#text' ? ` "${n.text.slice(0, 40)}"` : ''
  let s = `<${n.tag}${cls}>${t}`
  if (depth < 2) for (const k of n.kids.slice(0, 4)) s += ` ${brief(k, depth + 1)}`
  if (depth < 2 && n.kids.length > 4) s += ` …+${n.kids.length - 4}`
  return s
}

function diffPair(a: Canon, b: Canon, path: string, out: DiffReport): void {
  if (a.tag !== b.tag) {
    out.structure.push(`${path}: tag <${a.tag}> → <${b.tag}>`)
    return
  }
  if (a.tag === '#text') {
    if (a.text !== b.text) out.texts.push(`${path}: "${a.text}" → "${b.text}"`)
    return
  }
  const aCls = new Set(a.cls)
  const bCls = new Set(b.cls)
  const clsMinus = a.cls.filter((c) => !bCls.has(c))
  const clsPlus = b.cls.filter((c) => !aCls.has(c))
  if (clsMinus.length || clsPlus.length)
    out.attrs.push(`${path} <${a.tag}>: class −{${clsMinus.join(' ')}} +{${clsPlus.join(' ')}}`)
  const keys = new Set([...Object.keys(a.attrs), ...Object.keys(b.attrs)])
  for (const k of [...keys].sort()) {
    const av = a.attrs[k]
    const bv = b.attrs[k]
    if (av === bv) continue
    out.attrs.push(`${path} <${a.tag}>: ${k} ${JSON.stringify(av)} → ${JSON.stringify(bv)}`)
  }
  if (a.style !== b.style) out.attrs.push(`${path} <${a.tag}>: style ${JSON.stringify(a.style)} → ${JSON.stringify(b.style)}`)
  const { pairs, aOnly, bOnly } = align(a.kids, b.kids)
  for (const i of aOnly) out.structure.push(`${path}: only-legacy ${brief(a.kids[i])}`)
  for (const j of bOnly) out.structure.push(`${path}: only-port   ${brief(b.kids[j])}`)
  for (const [i, j] of pairs) diffPair(a.kids[i], b.kids[j], `${path}/${i}`, out)
}

export function diffTrees(legacy: Canon, port: Canon): DiffReport {
  const out: DiffReport = { classes: { onlyLegacy: [], onlyPort: [] }, copy: { onlyLegacy: [], onlyPort: [] }, structure: [], attrs: [], texts: [], errors: [], clean: false }

  const collectErrs = (root: Canon, side: string) => {
    for (const n of walk(root)) if (n.tag === '#error') out.errors.push(`${side}: ${n.text}`)
  }
  collectErrs(legacy, 'legacy')
  collectErrs(port, 'port')

  const lc = classVocab(legacy)
  const pc = classVocab(port)
  out.classes.onlyLegacy = [...lc.entries()].filter(([c]) => !pc.has(c)).sort((a, b) => b[1] - a[1])
  out.classes.onlyPort = [...pc.entries()].filter(([c]) => !lc.has(c)).sort((a, b) => b[1] - a[1])

  // Copy: multiset diff on normalized text per channel, then order check.
  const lCopy = copyLines(legacy)
  const pCopy = copyLines(port)
  const bucket = (lines: typeof lCopy) => {
    const m = new Map<string, { n: number; a11y: boolean }>()
    for (const l of lines) {
      const e = m.get(l.text) ?? { n: 0, a11y: l.a11y }
      e.n++
      e.a11y = e.a11y || l.a11y
      m.set(l.text, e)
    }
    return m
  }
  const lb = bucket(lCopy)
  const pb = bucket(pCopy)
  for (const [t, e] of lb) {
    const pn = pb.get(t)?.n ?? 0
    if (e.n > pn) out.copy.onlyLegacy.push({ text: t, a11y: e.a11y })
  }
  for (const [t, e] of pb) {
    const ln = lb.get(t)?.n ?? 0
    if (e.n > ln) out.copy.onlyPort.push({ text: t, a11y: e.a11y })
  }
  // Order check on the shared sequence: strip unmatched extras then compare pairwise.
  const lSeq = lCopy.map((l) => l.text).filter((t) => pb.has(t))
  const pSeq = pCopy.map((l) => l.text).filter((t) => lb.has(t))
  for (let i = 0; i < Math.max(lSeq.length, pSeq.length); i++) {
    if (lSeq[i] !== pSeq[i]) {
      const start = Math.max(0, i - 3)
      out.texts.push(`copy order diverges at #${i}: legacy …${lSeq.slice(start, i + 2).join(' | ')}… vs port …${pSeq.slice(start, i + 2).join(' | ')}…`)
      break
    }
  }

  diffPair(legacy, port, '', out)
  out.clean =
    !out.classes.onlyLegacy.length &&
    !out.classes.onlyPort.length &&
    !out.copy.onlyLegacy.length &&
    !out.copy.onlyPort.length &&
    !out.structure.length &&
    !out.attrs.length &&
    !out.texts.length &&
    !out.errors.length
  return out
}

/** Compact subtree stats for report headers. */
export function stats(root: Canon): { nodes: number; texts: number; classes: number } {
  let nodes = 0
  let texts = 0
  const cls = new Set<string>()
  for (const n of walk(root)) {
    nodes++
    if (n.tag === '#text') texts++
    for (const c of n.cls) cls.add(c)
  }
  return { nodes, texts, classes: cls.size }
}
