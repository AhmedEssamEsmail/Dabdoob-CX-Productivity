/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * The staffing engine of the legacy heatmap page (heatmap.closure.js — the
 * parts the bundle ran in the browser, plus the upload parsers it applied
 * after the server unpacked a file). Pure functions only; symbols renamed to
 * readable names with the minified closure name kept in each doc comment for
 * traceability (As -> hmPlan_, Cs -> hmRequirement_, dl -> hmAllocateShifts_,
 * xs -> hmDefaults_, rn -> hmCsvParse_, Ts -> hmWideParse_, ml -> hmLongParse_).
 */

export const HM_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // kt
const HM_EPS = 1e-9 // ie

/** Ms: the per-chat slot minutes (override, else conversation + no-reply). */
export function hmChatSlotMin_(t: any, n: any = {}): number {
  return n.slotMinutes > 0 ? n.slotMinutes : t.chats.slotMinutes > 0 ? t.chats.slotMinutes : (t.chats.conversationMin || 0) + (t.chats.noReplyTimeoutMin || 0)
}

/** he: "H:MM[:SS][ AM|PM]" or a number of hours -> minutes. */
export function hmParseTime_(t: unknown): number {
  if (typeof t === 'number') return Math.round(t * 60)
  const s = String(t).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([AaPp][Mm])?$/)
  if (!s) throw new Error(`Unrecognised time "${t}"`)
  let a = Number(s[1])
  const l = Number(s[2] || 0)
  if (s[4]) {
    const r = s[4].toUpperCase() === 'PM'
    a === 12 ? (a = r ? 12 : 0) : r && (a += 12)
  }
  return a * 60 + l
}

/** il: the interval starts the open window is cut into. */
export function hmSlots_(t: any): number[] {
  const n = t.intervalMinutes
  const s = hmParseTime_(t.open)
  const a = hmParseTime_(t.close)
  const l: number[] = []
  for (let r = s; r + n <= a; r += n) l.push(r)
  return l
}

/** sl: Erlang B — blocking probability for t trunks and n erlangs. */
export function hmErlangB_(t: number, n: number): number {
  let s = 1
  for (let a = 1; a <= t; a++) s = 1 + (s * a) / n
  return 1 / s
}

/** al: Erlang C — probability a call waits. */
export function hmErlangC_(t: number, n: number): number {
  if (t <= n) return 1
  const s = hmErlangB_(t, n)
  return s / (1 - (n / t) * (1 - s))
}

/** ws: one call interval — service level, ASA, occupancy. */
export function hmCallStats_(t: number, n: number, s: number, a: number) {
  const l = (t * n) / 3600
  if (t <= 0) return { A: 0, pWait: 0, sl: 1, asa: 0, occ: 0, stable: true }
  if (s <= 0 || s <= l)
    return { A: l, pWait: 1, sl: 0, asa: 1 / 0, occ: s > 0 ? l / s : 1 / 0, stable: false }
  const r = hmErlangC_(s, l)
  return {
    A: l,
    pWait: r,
    sl: 1 - r * Math.exp((-(s - l) * a) / n),
    asa: (r * n) / (s - l),
    occ: l / s,
    stable: true,
  }
}

/** ll: fewest agents to hit service level s within a seconds. */
export function hmCallStaff_(t: number, n: number, s: number, a: number, l = 500): number {
  if (t <= 0) return 0
  const r = (t * n) / 3600
  let i = Math.floor(r) + 1
  for (let h = 0; h < l; h++) {
    if (hmCallStats_(t, n, i, a).sl >= s) return i
    i++
  }
  return i
}

/** qe: minutes -> "HH:MM". */
export function hmHHMM_(t: number): string {
  const n = Math.floor(t / 60) % 24
  const s = t % 60
  return `${String(n).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** ut: a raw country name through the alias table (case-insensitive). */
export function hmAlias_(t: unknown, n: Record<string, string> = {}): string {
  const s = String(t ?? '').trim()
  if (!s || s === '*') return '*'
  if (n[s]) return n[s]
  const a = Object.keys(n).find((l) => l.toLowerCase() === s.toLowerCase())
  return a ? n[a] : s
}

/** Ss: the named countries a heatmap's cells use (aliases applied, '*' out). */
export function hmCountriesOf_(t: any, n?: any): string[] {
  const s = (n && n.countryAliases) || {}
  return [...new Set((t.cells as any[]).map((a) => hmAlias_(a.country, s)).filter((a) => a !== '*'))].sort()
}

/** ks: a day name or index -> 0..6. */
export function hmDay_(t: unknown): number {
  if (typeof t === 'number') return t
  const n = HM_DAYS.findIndex((s) => s.toLowerCase() === String(t).trim().slice(0, 3).toLowerCase())
  if (n < 0) throw new Error(`Unrecognised day "${t}"`)
  return n
}

/** rl: the cells spread over channel|day|minute buckets at the wanted granularity. */
export function hmSpread_(t: any, n: any, s?: string) {
  const a = n.intervalMinutes
  const l = t.intervalMinutes || a
  if (l % a !== 0 && a % l !== 0) throw new Error(`Upload interval ${l} min is incompatible with ${a} min`)
  const r = n.countryAliases || {}
  const i = n.countryList && n.countryList.length ? n.countryList.slice() : hmCountriesOf_(t, n)
  const h = new Set(i)
  const p = s ? [s] : n.countries && n.countries.length ? n.countries : i
  const d = new Set(p)
  const u = i.every((v: string) => d.has(v))
  let c = 0
  let o = 0
  for (const v of t.cells as any[]) {
    const y = hmAlias_(v.country, r)
    if (y !== '*' && h.has(y)) {
      o += v.volume
      if (d.has(y)) c += v.volume
    }
  }
  const f = o > 0 ? c / o : 0
  let g: number
  if (!s && !(n.countries && n.countries.length)) g = 1
  else if (n.sharedVolumeMode === 'full') g = p.length ? 1 : 0
  else if (o === 0) g = u ? 1 : 0
  else if (n.sharedVolumeMode === 'allOnly') g = u && !s ? 1 : 0
  else g = f
  const b = new Map<string, { volume: number; workSec: number }>()
  for (const v of t.cells as any[]) {
    const y = n.channels[v.channel]
    if (!y) continue
    const w = hmAlias_(v.country, r)
    let M: number
    if (w === '*') M = g
    else if (h.has(w)) M = d.has(w) ? 1 : 0
    else M = 0
    if (M === 0 || !(v.volume > 0)) continue
    const $ = v.ahtSec > 0 ? v.ahtSec : y.ahtSec
    const L = hmParseTime_(v.start)
    const H = hmDay_(v.day)
    const O = l > a ? l / a : 1
    const T = l > a ? a : l
    for (let S = 0; S < O; S++) {
      const C = l > a ? L + S * T : Math.floor(L / a) * a
      const q = `${v.channel}|${H}|${C}`
      const N = b.get(q) || { volume: 0, workSec: 0 }
      const E = (v.volume * M) / O
      N.volume += E
      N.workSec += E * $
      b.set(q, N)
    }
  }
  return b
}

/** Cs: the requirement grid — calls (Erlang), chats, deferred work per interval. */
export function hmRequirement_(t: any, n: any, s?: string) {
  const a = n.intervalMinutes
  const l = a / 60
  const r = hmSpread_(t, n, s)
  const i = hmSlots_(n)
  const h = i.length - 1
  const p = hmParseTime_(n.open)
  const d = hmParseTime_(n.close)
  const u = n.channels
  const c = Object.entries(u).filter(([, $]: [string, any]) => $.include !== false)
  const o = c.filter(([, $]: [string, any]) => $.kind === 'call').map(([$]) => $)
  const f = c.filter(([, $]: [string, any]) => $.kind === 'chat').map(([$]) => $)
  const g = c.filter(([, $]: [string, any]) => $.kind === 'deferred').map(([$]) => $)
  const m = ($: string, L: number, H: number) => r.get(`${$}|${L}|${H}`) || { volume: 0, workSec: 0 }
  const b = Array.from({ length: 7 }, () => ({ before: {} as Record<string, any>, after: {} as Record<string, any> }))
  const v: Record<string, number> = {}
  for (const [$, L] of r) {
    const [H, O, T] = $.split('|')
    const S = +O
    const C = +T
    if ((C >= p && C + a <= d) || !c.find(([N]) => N === H)) continue
    v[H] = (v[H] || 0) + L.volume
    const q = C < p ? b[S].before : b[S].after
    q[H] = q[H] || { volume: 0, workSec: 0 }
    q[H].volume += L.volume
    q[H].workSec += L.workSec
  }
  const y = ($: string) => Math.max(0, Math.floor((u[$].slaMin ?? 60) / a) - 1)
  let w: any[] = []
  const M: any[] = []
  for (let $ = 0; $ < 14; $++) {
    const L = $ % 7
    const H = $ * i.length
    const O = (L + 6) % 7
    for (const S of g) {
      const C = [b[L].before[S], b[O].after[S]].filter(Boolean)
      for (const q of C)
        if (q.volume > 0)
          w.push({ id: S, rem: q.workSec / 3600, due: H + y(S), np: u[S].preemptible === false })
    }
    const T: any[] = []
    for (let S = 0; S < i.length; S++) {
      const C = i[S]
      const q = H + S
      let N = 0
      let E = 0
      for (const B of o) {
        const te = m(B, L, C)
        N += te.volume
        E += te.workSec
      }
      const R = N > 0 ? E / N : 0
      const k = N / l
      const A = (k * R) / 3600
      const I = N > 0 ? hmCallStaff_(k, R, n.calls.slTarget, n.calls.answerWithinSec) : 0
      let x = 0
      let P = 0
      let U = 0
      for (const B of f) {
        const te = m(B, L, C)
        const re = u[B].concurrency || n.chats.concurrency
        U += te.volume
        if (n.chats.model === 'legacy')
          x += te.workSec / 3600 / l / (n.chats.ahtBasis === 'effort' ? 1 : re)
        else {
          x += te.workSec / 3600 / l
          P += ((te.volume / l) * hmChatSlotMin_(n, u[B])) / 60 / re
        }
      }
      const V = x / n.occupancyCap
      const de = {
        volume: U,
        effortAgents: x,
        effortHC: V,
        slotAgents: P,
        hc: Math.max(V, P),
        binding: U > 0 ? (P > V + HM_EPS ? 'slots' : 'effort') : null,
      }
      for (const B of g) {
        const te = m(B, L, C)
        if (te.workSec <= 0) continue
        let re = q + y(B)
        if (n.overnight === 'forceBeforeClose') re = Math.min(re, H + h)
        w.push({ id: B, rem: te.workSec / 3600, due: re, np: u[B].preemptible === false })
      }
      w.sort((B, te) => B.due - te.due)
      let J = 0
      let se = 0
      for (const B of w) if (B.due <= q) (B.np ? (se += B.rem / l) : (J += B.rem / l))
      const Le = n.minOnFloor || 0
      const ue = Math.max(I + se, (A + x + J + se) / n.occupancyCap, P, Le)
      let Ee = n.occupancyCap * ue - (A + x + J + se)
      let on = ue - I - se
      let St = J
      let Mt = se
      for (const B of w) {
        if (B.due <= q) {
          B.rem = 0
          continue
        }
        const te = B.np ? Math.min(Ee, on) : Ee
        if (te <= HM_EPS) continue
        const re = Math.min(B.rem, te * l)
        B.rem -= re
        Ee -= re / l
        if (B.np) {
          on -= re / l
          Mt += re / l
        } else St += re / l
      }
      w = w.filter((B) => B.rem > HM_EPS)
      const cn = A + x + St + Mt
      if ($ >= 7)
        T.push({
          start: C,
          label: hmHHMM_(C),
          calls: { volume: N, lambdaPerHour: k, ahtSec: R, A, N: I },
          chatAgents: x,
          chat: de,
          deferredServed: { preemptible: St, nonPreemptible: Mt },
          workload: cn,
          onFloor: ue,
          occupancy: ue > 0 ? cn / ue : 0,
          rostered: ue / (1 - n.shrinkage),
        })
    }
    if (n.overnight === 'forceBeforeClose') w = []
    if ($ >= 7) M.push({ day: HM_DAYS[L], intervals: T })
  }
  return { intervalMinutes: a, slots: i, days: M, offHours: v }
}

/** cl: dedicated pooling — one requirement per country, summed. */
export function hmDedicated_(t: any, n: any) {
  const s = n.countries && n.countries.length ? n.countries : hmCountriesOf_(t)
  const a = s.map((i: string) => hmRequirement_(t, n, i))
  const l = a[0]
  const r = l.days.map((i: any, h: number) => ({
    day: i.day,
    intervals: i.intervals.map((p: any, d: number) => {
      const u = (y: string) => a.reduce((w: number, M: any) => w + M.days[h].intervals[d][y], 0)
      const c = a.reduce((y: number, w: any) => y + w.days[h].intervals[d].calls.N, 0)
      const o = a.reduce((y: number, w: any) => y + w.days[h].intervals[d].calls.A, 0)
      const f = a.reduce((y: number, w: any) => y + w.days[h].intervals[d].calls.volume, 0)
      const g = u('onFloor')
      const m = u('workload')
      const b = (y: string) => a.reduce((w: number, M: any) => w + (M.days[h].intervals[d].chat?.[y] || 0), 0)
      const v: any = {
        volume: b('volume'),
        effortAgents: b('effortAgents'),
        effortHC: b('effortHC'),
        slotAgents: b('slotAgents'),
      }
      v.hc = Math.max(v.effortHC, v.slotAgents)
      v.binding = v.volume > 0 ? (v.slotAgents > v.effortHC + HM_EPS ? 'slots' : 'effort') : null
      return {
        ...p,
        chat: v,
        calls: { ...p.calls, volume: f, A: o, N: c },
        chatAgents: u('chatAgents'),
        workload: m,
        onFloor: g,
        occupancy: g > 0 ? m / g : 0,
        rostered: u('rostered'),
      }
    }),
  }))
  return { ...l, days: r, perCountry: Object.fromEntries(s.map((i: string, h: number) => [i, a[h]])) }
}

/** dl: shift allocation — the fewest bodies whose shifts still cover every interval. */
export function hmAllocateShifts_(t: number[], n: number[], s: number, a: any[], l: any = {}) {
  const r = s / 60
  const i = a.map((m) => n.map((b) => m.startMin <= b && b + s <= m.endMin))
  const h = i.map((m) => m.filter(Boolean).length * r)
  const p = n.filter((m, b) => t[b] > HM_EPS && !i.some((v) => v[b]))
  const d = n.map((m, b) => b).filter((m) => i.some((b) => b[m]))
  const u = a.map((m, b) => {
    let v = 0
    d.forEach((y) => {
      if (i[b][y]) v = Math.max(v, t[y])
    })
    return Math.ceil(v - HM_EPS) + (l.flexible ? 1 : 0)
  })
  const c = l.flexible ? l.presence : t
  let o: any = null
  const f = new Array(a.length).fill(0)
  const g = (m: number, b: number): void => {
    if (o && b > o.total) return
    if (m === a.length) {
      let v = 0
      for (const y of d) {
        let w = 0
        for (let M = 0; M < a.length; M++) if (i[M][y]) w += f[M]
        if (w + HM_EPS < c[y]) return
        v += (w - c[y]) * r
      }
      if (l.flexible) {
        const y = f.reduce((w, M, $) => w + M * h[$], 0)
        if (v + HM_EPS < l.shrinkage * y) return
      }
      if (!o || b < o.total || (b === o.total && v < o.surplus - HM_EPS))
        o = { total: b, surplus: v, alloc: f.slice() }
      return
    }
    for (let v = 0; v <= u[m]; v++) {
      f[m] = v
      g(m + 1, b + v)
    }
    f[m] = 0
  }
  g(0, 0)
  return { ...(o || { total: 0, surplus: 0, alloc: f.slice() }), uncovered: p.map(hmHHMM_) }
}

/** hl: the roster — bodies per shift per day plus the scheduled coverage. */
export function hmRoster_(t: any, n: any) {
  const s = t.intervalMinutes
  const a = n.shifts
    .filter((r: any) => r.enabled !== false)
    .map((r: any) => ({
      id: r.id,
      startMin: hmParseTime_(r.start),
      endMin: hmParseTime_(r.end),
      paidHours: (hmParseTime_(r.end) - hmParseTime_(r.start)) / 60,
    }))
  const l = t.days.map((r: any) => {
    const i = r.intervals.map((d: any) => d.rostered)
    const h = hmAllocateShifts_(
      i, t.slots, s, a,
      n.shrinkagePlacement === 'flexible'
        ? { flexible: true, presence: r.intervals.map((d: any) => d.onFloor), shrinkage: n.shrinkage }
        : {}
    )
    const p = t.slots.map((d: number) => a.reduce((u: number, c: any, o: number) => u + (c.startMin <= d && d + s <= c.endMin ? h.alloc[o] : 0), 0))
    return {
      day: r.day,
      bodies: Object.fromEntries(a.map((d: any, u: number) => [d.id, h.alloc[u]])),
      total: h.total,
      coverage: p,
      uncovered: h.uncovered,
    }
  })
  return { shifts: a, days: l }
}

/** Lt: JSON deep copy (undefined passes through). */
export function hmDeepCopy_(t: any): any {
  return t === undefined ? t : JSON.parse(JSON.stringify(t))
}

/** Rn: a plain object (not an array). */
export function hmIsObj_(t: any): boolean {
  return t && typeof t === 'object' && !Array.isArray(t)
}

/** ln: deep merge of n onto t (n wins; plain objects recurse). */
export function hmDeepMerge_(t: any, n: any): any {
  if (!n) return hmDeepCopy_(t)
  const s = hmDeepCopy_(t)
  for (const [a, l] of Object.entries(n)) s[a] = hmIsObj_(l) && hmIsObj_(s[a]) ? hmDeepMerge_(s[a], l) : hmDeepCopy_(l)
  return s
}

/** ol: the data problems the page lists under the result. */
export function hmProblems_(t: any, n: any): string[] {
  const s: string[] = []
  const a = new Set<string>()
  for (const l of t.cells as any[]) {
    if (!n.channels[l.channel]) a.add(l.channel)
    if (!(l.volume >= 0)) s.push(`Negative or missing volume at ${l.channel} ${l.day} ${l.start}`)
  }
  if (a.size) s.push(`Unknown channels (ignored): ${[...a].join(', ')}`)
  if (n.countryList && n.countryList.length) {
    const l = new Set(n.countryList)
    const r = new Map<string, number>()
    for (const i of t.cells as any[]) {
      const h = hmAlias_(i.country, n.countryAliases || {})
      if (h !== '*' && !l.has(h)) r.set(h, (r.get(h) || 0) + (i.volume || 0))
    }
    if (r.size)
      s.push(
        `Countries not in the country list (excluded; add them or an alias): ${[...r].map(([i, h]) => `${i} (${h.toFixed(1)}/wk-day vol)`).join(', ')}`
      )
  }
  return s
}

/** ul: the headcount answer — hires, per-shift hires, hours, warnings, realised SL. */
export function hmHeadcount_(t: any, n: any, s: any) {
  const a = t.intervalMinutes
  const l = a / 60
  const r = s.shiftsPerAgentPerWeek
  const i = s.absenceShrinkage || 0
  const h = n.days.reduce((T: number, S: any) => T + S.total, 0)
  const p = h / r / (1 - i)
  let d = Math.ceil(p - HM_EPS)
  const u = Math.max(...n.days.map((T: any) => T.total))
  const c: string[] = []
  if (d < u) {
    c.push(`Peak day needs ${u} bodies but arithmetic gives ${d}; raised to ${u}.`)
    d = u
  }
  const o = n.days.filter((T: any) => T.total >= d).map((T: any) => T.day)
  if (o.length) c.push(`Zero slack (every hire working) on: ${o.join(', ')}.`)
  const f = n.days.flatMap((T: any) => T.uncovered.map((S: string) => `${T.day} ${S}`))
  if (f.length) c.push(`UNCOVERED intervals (no enabled shift): ${f.join(', ')}`)
  const g = n.shifts.map((T: any) => {
    const S = n.days.map((N: any) => N.bodies[T.id])
    const C = S.reduce((N: number, E: number) => N + E, 0)
    const q = C / r / (1 - i)
    return {
      id: T.id,
      start: hmHHMM_(T.startMin),
      end: hmHHMM_(T.endMin),
      bodiesByDay: S,
      shiftDays: C,
      hiresExact: q,
      hiresIfFixed: Math.ceil(q - HM_EPS),
    }
  })
  let m = 0
  let b = 0
  let v = 0
  let y = 0
  let w = 0
  t.days.forEach((T: any, S: number) =>
    T.intervals.forEach((C: any, q: number) => {
      m += C.workload * l
      b += C.onFloor * l
      v += C.rostered * l
      if (C.calls.volume > 0) {
        const N = n.days[S].coverage[q]
        let E = N * (1 - s.shrinkage)
        if (s.shrinkagePlacement === 'flexible') {
          const A = t.days[S].intervals
          const I = n.days[S].coverage
          const x = A.reduce((U: number, V: any, de: number) => U + Math.max(0, I[de] - V.onFloor), 0)
          const P = s.shrinkage * I.reduce((U: number, V: number) => U + V, 0)
          E = N - (x > 0 ? (Math.max(0, N - C.onFloor) / x) * P : 0)
        }
        const R = Math.floor(E - C.deferredServed.nonPreemptible + HM_EPS)
        const k = hmCallStats_(C.calls.lambdaPerHour, C.calls.ahtSec, R, s.calls.answerWithinSec)
        y += C.calls.volume
        w += C.calls.volume * k.sl
      }
    })
  )
  const M = n.days.reduce((T: number, S: any) => T + n.shifts.reduce((C: number, q: any) => C + S.bodies[q.id] * q.paidHours, 0), 0)
  const $ = h > 0 ? M / h : 0
  const L = d * r * $
  const H = b > 0 ? m / b : 0
  const O = H >= 0.75 ? 'workload-driven' : H < 0.4 ? 'coverage-driven' : 'mixed'
  return {
    hires: d,
    hiresExact: p,
    shiftDays: h,
    peakDay: u,
    perShift: g,
    warnings: c,
    hours: { work: m, onFloor: b, rostered: v, scheduled: M, hired: L },
    uplift: {
      occupancyAndErlang: m > 0 ? b / m : 0,
      shrinkage: b > 0 ? v / b : 0,
      shiftShapeAndRounding: v > 0 ? M / v : 0,
      hireRounding: M > 0 ? L / M : 0,
      total: m > 0 ? L / m : 0,
    },
    occupancy: H,
    regime: O,
    chatBinding: t.days.reduce(
      (T: any, S: any) => (
        S.intervals.forEach((C: any) => {
          const q = C.chat?.binding
          if (q) T[q]++
        }),
        T
      ),
      { effort: 0, slots: 0 }
    ),
    realisedCallSL: y > 0 ? w / y : null,
  }
}

/** xs: the default assumption set. */
export function hmDefaults_() {
  return {
    intervalMinutes: 30,
    open: '09:30',
    close: '22:00',
    channels: {
      inbound_calls: { label: 'Inbound calls', kind: 'call', ahtSec: 240, include: true },
      social_media: { label: 'Social media chat', kind: 'chat', ahtSec: 180, include: true },
      in_app: { label: 'In-App chat', kind: 'chat', ahtSec: 180, include: true },
      internal_tickets: { label: 'Internal escalations', kind: 'deferred', ahtSec: 180, include: true, slaMin: 60, preemptible: true, isTicket: true },
      waiting_address: { label: 'Waiting Address (outbound)', kind: 'deferred', ahtSec: 120, include: true, slaMin: 60, preemptible: false, isTicket: false, group: 'waiting_address' },
      customer_didnt_answer: { label: "Customer didn't answer (retry)", kind: 'deferred', ahtSec: 60, include: true, slaMin: 60, preemptible: false, isTicket: false, group: 'waiting_address' },
    },
    calls: { slTarget: 0.8, answerWithinSec: 30 },
    chats: { concurrency: 5, model: 'effortAndSlots', noReplyTimeoutMin: 10, conversationMin: 3, slotMinutes: null, ahtBasis: 'duration' },
    occupancyCap: 0.85,
    minOnFloor: 1,
    overnight: 'carryToOpen',
    shrinkage: 0.3,
    shrinkagePlacement: 'uniform',
    absenceShrinkage: 0,
    timeZone: 'Asia/Kuwait',
    shifts: [
      { id: 'AM', start: '09:30', end: '18:30', enabled: true },
      { id: 'PM', start: '13:00', end: '22:00', enabled: true },
      { id: 'MID', start: '11:00', end: '20:00', enabled: false },
    ],
    shiftsPerAgentPerWeek: 5,
    countryList: null,
    countryAliases: {},
    countries: null,
    pooling: 'pooled',
    sharedVolumeMode: 'proportional',
  }
}

/** As: the whole plan — merged assumptions, requirement, roster, headcount, problems. */
export function hmPlan_(t: any, n: any) {
  const s = hmDeepMerge_(hmDefaults_(), n)
  const a = s.pooling === 'dedicated' ? hmDedicated_(t, s) : hmRequirement_(t, s)
  const l = hmRoster_(a, s)
  const r = hmHeadcount_(a, l, s)
  if (s.pooling === 'dedicated') r.realisedCallSL = null
  return { assumptions: s, requirement: a, roster: l, headcount: r, problems: hmProblems_(t, s) }
}

// ---------------------------------------------------------------------------
// Upload formats (the browser-side parsers of the legacy bundle)
// ---------------------------------------------------------------------------

/** pl: channel spellings the upload recognises. */
export const HM_CHANNEL_NAMES: Record<string, string> = {
  inbound: 'inbound_calls',
  'inbound calls': 'inbound_calls',
  calls: 'inbound_calls',
  'call center': 'inbound_calls',
  'social media': 'social_media',
  social: 'social_media',
  'in-app': 'in_app',
  'in app': 'in_app',
  'live chat': 'in_app',
  'chat with us': 'in_app',
  wa: 'waiting_address',
  'waiting address': 'waiting_address',
  "customer didn't answer": 'customer_didnt_answer',
  'customer didnt answer': 'customer_didnt_answer',
  'internal tickets': 'internal_tickets',
  tickets: 'internal_tickets',
}

/** $s: a channel label -> its key (unknown names are kept, normalised). */
export function hmChannelKey_(t: unknown): string {
  const n = String(t).trim().toLowerCase().replace(/\s+/g, ' ')
  return HM_CHANNEL_NAMES[n] || n.replace(/[^a-z0-9]+/g, '_')
}

/** rn: CSV text -> rows of cells (quotes, escaped quotes, commas, newlines). */
export function hmCsvParse_(t: string): string[][] {
  const n: string[][] = []
  let s: string[] = []
  let a = ''
  let l = false
  for (let r = 0; r < t.length; r++) {
    const i = t[r]
    if (l) {
      if (i === '"') {
        if (t[r + 1] === '"') {
          a += '"'
          r++
        } else l = false
      } else a += i
    } else if (i === '"') l = true
    else if (i === ',') {
      s.push(a)
      a = ''
    } else if (i === '\n' || i === '\r') {
      if (i === '\r' && t[r + 1] === '\n') r++
      s.push(a)
      n.push(s)
      s = []
      a = ''
    } else a += i
  }
  if (a !== '' || s.length) {
    s.push(a)
    n.push(s)
  }
  return n
}

/** Ts: the HeatMap-tab layout (blocks of Interval,Sun..Sat side by side). */
export function hmWideParse_(
  t: string,
  { country: n = '*', intervalMinutes: s = 60 }: { country?: string; intervalMinutes?: number } = {}
): { intervalMinutes: number; cells: any[]; ahtMinutes: Record<string, number> } {
  const a = hmCsvParse_(t)
  const l = a[1] || []
  const r: any[] = []
  const i: Record<string, number> = {}
  let h = ''
  const p = (a[0] || []).map((d) => {
    if (d && d.trim()) h = d.trim()
    return h
  })
  l.forEach((d, u) => {
    if (String(d).trim().toLowerCase() !== 'interval') return
    const c = p[u] || `block_${u}`
    const o = hmChannelKey_(c)
    for (let f = 2; f < a.length; f++) {
      const g = (a[f][u] || '').trim()
      if (g === '' || isNaN(Number(g))) {
        if (g === '') break
        continue
      }
      for (let m = 0; m < 7; m++) {
        const b = (a[f][u + 1 + m] || '').trim()
        const v = Number(b)
        if (b !== '' && !isNaN(v))
          r.push({ country: n, channel: o, day: HM_DAYS[m], start: hmHHMM_(Math.round(Number(g) * 60)), volume: v })
      }
    }
  })
  for (let d = 0; d < (a[0] || []).length; d++)
    if (String(a[0][d]).trim().toLowerCase() === 'queue' && String(a[0][d + 1]).trim().toLowerCase() === 'aht')
      for (let u = 1; u < a.length; u++) {
        const c = (a[u][d] || '').trim()
        const o = Number(a[u][d + 1])
        if (c && !isNaN(o)) i[c] = o
      }
  return { intervalMinutes: s, cells: r, ahtMinutes: i }
}

/** _l: the AHT table's queue labels -> the channels they set. */
export const HM_AHT_GROUPS: Record<string, string[]> = {
  calls: ['inbound_calls'],
  inbound: ['inbound_calls'],
  chats: ['social_media', 'in_app'],
  'social media': ['social_media'],
  'in-app': ['in_app'],
  wa: ['waiting_address'],
  'waiting address': ['waiting_address'],
  "customer didn't answer": ['customer_didnt_answer'],
  tickets: ['internal_tickets'],
  'internal tickets': ['internal_tickets'],
  escalations: ['internal_tickets'],
}

/** mt: one-decimal locale number. */
export const hmFmt_ = (t: number): string =>
  (Math.round(t * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 })

/** Vt: set (or delete, on undefined) one deep path, immutably. */
export function hmSetPath_(t: any, n: string[], s: any): any {
  const [a, ...l] = n
  const r = { ...t }
  if (!l.length) {
    if (s === undefined) delete r[a]
    else r[a] = s
    return r
  }
  const i = r[a] && typeof r[a] === 'object' && !Array.isArray(r[a]) ? r[a] : {}
  r[a] = hmSetPath_(i, l, s)
  return r
}

/** Ut: read one deep path (undefined when absent). */
export function hmGetPath_(t: any, n: string[]): any {
  let s = t
  for (const a of n) {
    if (s === null || typeof s !== 'object') return
    s = s[a]
  }
  return s
}

/** fl: rows -> CSV text (interval columns get their 0..1 fractions turned into HH:MM). */
export function hmCsv_(t: unknown[][]): string {
  const n = new Set<number>()
  return t
    .map((s) =>
      (
        s.forEach((a, l) => {
          if (String(a).trim().toLowerCase() === 'interval') n.add(l)
        }),
        s.map((a, l) => {
          let r = String(a ?? '')
          const i = Number(r)
          if (n.has(l) && r !== '' && i > 0 && i < 1) {
            const h = Math.round(i * 1440)
            r = `${String(Math.floor(h / 60)).padStart(2, '0')}:${String(h % 60).padStart(2, '0')}`
          }
          return /[",\n\r]/.test(r) ? `"${r.replace(/"/g, '""')}"` : r
        }).join(',')
      )
    )
    .join('\n')
}

/** gl: sniffs which upload layout the rows are in. */
export function hmSniff_(t: unknown[][]): 'long' | 'wide' | 'unknown' {
  const n = (t[0] ?? []).map((s) => String(s).trim().toLowerCase())
  if (['country', 'channel', 'day', 'interval', 'volume'].every((s) => n.includes(s))) return 'long'
  if ((t[1] ?? []).some((s) => String(s).trim().toLowerCase() === 'interval')) return 'wide'
  return 'unknown'
}

/** ml: layout 1 — one row per value (country,channel,day,interval,volume[,aht_sec]). */
export function hmLongParse_(t: string, n = 60): { intervalMinutes: number; cells: any[] } {
  const s = hmCsvParse_(t).filter((o) => o.some((f) => f.trim() !== ''))
  const a = s[0].map((o) => o.trim().toLowerCase())
  const l = (o: string) => {
    const f = a.indexOf(o)
    if (f < 0) throw new Error(`Missing column "${o}"`)
    return f
  }
  const [r, i, h, p, d] = ['country', 'channel', 'day', 'interval', 'volume'].map(l)
  const u = a.indexOf('aht_sec')
  const c = s.slice(1).map((o) => ({
    country: o[r].trim() || '*',
    channel: hmChannelKey_(o[i]),
    day: HM_DAYS[hmDay_(o[h])],
    start: hmHHMM_(hmParseTime_(isNaN(+o[p]) ? o[p] : +o[p])),
    volume: Number(o[d]) || 0,
    ...(u >= 0 && o[u] !== '' ? { ahtSec: Number(o[u]) } : {}),
  }))
  return { intervalMinutes: n, cells: c }
}

// ---------------------------------------------------------------------------
// The two downloadable example files (Kt / Ls, tables qs / Os / pt)
// ---------------------------------------------------------------------------

const HM_EXAMPLE_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HM_EXAMPLE_HOURS = [9, 10, 11, 12, 13, 14]
const HM_EXAMPLE_DATA: Record<string, number[][]> = {
  Inbound: [
    [6, 7, 8, 6, 7, 7, 5],
    [9, 10, 11, 9, 10, 10, 8],
    [10, 11, 12, 10, 11, 11, 9],
    [8, 9, 10, 8, 9, 9, 7],
    [7, 8, 9, 7, 8, 8, 6],
    [7, 8, 8, 7, 8, 8, 6],
  ],
  WA: [
    [4, 4, 4, 4, 5, 5, 4],
    [5, 5, 6, 5, 6, 6, 5],
    [6, 6, 6, 6, 7, 7, 5],
    [5, 5, 5, 5, 6, 6, 5],
    [4, 4, 5, 4, 5, 5, 4],
    [4, 4, 4, 4, 5, 5, 4],
  ],
}

/** Kt: the "one row per value" example file. */
export function hmExampleLong_(): string {
  const t = ['country,channel,day,interval,volume,aht_sec']
  for (const n of Object.keys(HM_EXAMPLE_DATA))
    HM_EXAMPLE_HOURS.forEach((s, a) => {
      HM_EXAMPLE_DAYS.forEach((l, r) => {
        t.push(`Kuwait,${n},${l},${String(s).padStart(2, '0')}:00,${HM_EXAMPLE_DATA[n][a][r]},${n === 'Inbound' ? 240 : 150}`)
      })
    })
  return t.join('\n')
}

/** Ls: the "HeatMap tab layout" example file (blocks side by side). */
export function hmExampleWide_(): string {
  const t = Object.keys(HM_EXAMPLE_DATA)
  const n = ''
  const s: string[] = []
  const a: string[] = []
  t.forEach((r, i) => {
    s.push(r, ...Array(7).fill(n))
    a.push('Interval', ...HM_EXAMPLE_DAYS)
    if (i < t.length - 1) {
      s.push(n)
      a.push(n)
    }
  })
  const l = HM_EXAMPLE_HOURS.map((r, i) => {
    const h: unknown[] = []
    t.forEach((p, d) => {
      h.push(r, ...HM_EXAMPLE_DATA[p][i])
      if (d < t.length - 1) h.push(n)
    })
    return h.join(',')
  })
  return [s.join(','), a.join(','), ...l].join('\n')
}
