/** Verbatim extract of the legacy heatmap engine from the minified Queue bundle
 * (.devin/work/extract/queue/app.pretty.js — beautified, names as-minified).
 * Pure functions only: the FileReader/uploader (yl) and DOM/Preact parts are
 * left out. Loaded into the vm oracle by tests/golden/queue-heatmap.test.ts.
 * Minified -> port map: sl=hmErlangB_ al=hmErlangC_ ws=hmCallStats_ ll=hmCallStaff_
 * he=hmParseTime_ qe=hmHHMM_ ks=hmDay_ xs=hmDefaults_ Rn=hmIsObj_ ln=hmDeepMerge_
 * Lt=hmDeepCopy_ ut=hmAlias_ Ss=hmCountriesOf_ rl=hmSpread_ ol=hmProblems_
 * Ms=hmChatSlotMin_ il=hmSlots_ Cs=hmRequirement_ cl=hmDedicated_ dl=hmAllocateShifts_
 * hl=hmRoster_ ul=hmHeadcount_ As=hmPlan_ rn=hmCsvParse_ pl=HM_CHANNEL_NAMES
 * $s=hmChannelKey_ ml=hmLongParse_ Ts=hmWideParse_ _l=HM_AHT_GROUPS mt=hmFmt_
 * Ut=hmGetPath_ Vt=hmSetPath_ fl=hmCsv_ gl=hmSniff_ qs/Os/pt=HM_EXAMPLE_* Kt/Ls=hmExample*
 */
var kt = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], ie = 1e-9;
function sl(t, n) {
  let s = 1;
  for (let a = 1; a <= t; a++) s = 1 + s * a / n;
  return 1 / s;
}
function al(t, n) {
  if (t <= n) return 1;
  const s = sl(t, n);
  return s / (1 - n / t * (1 - s));
}
function ws(t, n, s, a) {
  const l = t * n / 3600;
  if (t <= 0) return {
    A: 0,
    pWait: 0,
    sl: 1,
    asa: 0,
    occ: 0,
    stable: !0
  };
  if (s <= 0 || s <= l) return {
    A: l,
    pWait: 1,
    sl: 0,
    asa: 1 / 0,
    occ: s > 0 ? l / s : 1 / 0,
    stable: !1
  };
  const r = al(s, l);
  return {
    A: l,
    pWait: r,
    sl: 1 - r * Math.exp(-(s - l) * a / n),
    asa: r * n / (s - l),
    occ: l / s,
    stable: !0
  };
}
function ll(t, n, s, a, l = 500) {
  if (t <= 0) return 0;
  const r = t * n / 3600;
  let i = Math.floor(r) + 1;
  for (let h = 0; h < l; h++) {
    if (ws(t, n, i, a).sl >= s) return i;
    i++;
  }
  return i;
}
function he(t) {
  if (typeof t == "number") return Math.round(t * 60);
  const s = String(t).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!s) throw new Error(`Unrecognised time "${t}"`);
  let a = Number(s[1]);
  const l = Number(s[2] || 0);
  if (s[4]) {
    const r = s[4].toUpperCase() === "PM";
    a === 12 ? a = r ? 12 : 0 : r && (a += 12);
  }
  return a * 60 + l;
}
function qe(t) {
  const n = Math.floor(t / 60) % 24,
    s = t % 60;
  return `${String(n).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function ks(t) {
  if (typeof t == "number") return t;
  const n = kt.findIndex(s => s.toLowerCase() === String(t).trim().slice(0, 3).toLowerCase());
  if (n < 0) throw new Error(`Unrecognised day "${t}"`);
  return n;
}
function xs() {
  return {
    intervalMinutes: 30,
    open: "09:30",
    close: "22:00",
    channels: {
      inbound_calls: {
        label: "Inbound calls",
        kind: "call",
        ahtSec: 240,
        include: !0
      },
      social_media: {
        label: "Social media chat",
        kind: "chat",
        ahtSec: 180,
        include: !0
      },
      in_app: {
        label: "In-App chat",
        kind: "chat",
        ahtSec: 180,
        include: !0
      },
      internal_tickets: {
        label: "Internal escalations",
        kind: "deferred",
        ahtSec: 180,
        include: !0,
        slaMin: 60,
        preemptible: !0,
        isTicket: !0
      },
      waiting_address: {
        label: "Waiting Address (outbound)",
        kind: "deferred",
        ahtSec: 120,
        include: !0,
        slaMin: 60,
        preemptible: !1,
        isTicket: !1,
        group: "waiting_address"
      },
      customer_didnt_answer: {
        label: "Customer didn't answer (retry)",
        kind: "deferred",
        ahtSec: 60,
        include: !0,
        slaMin: 60,
        preemptible: !1,
        isTicket: !1,
        group: "waiting_address"
      }
    },
    calls: {
      slTarget: .8,
      answerWithinSec: 30
    },
    chats: {
      concurrency: 5,
      model: "effortAndSlots",
      noReplyTimeoutMin: 10,
      conversationMin: 3,
      slotMinutes: null,
      ahtBasis: "duration"
    },
    occupancyCap: .85,
    minOnFloor: 1,
    overnight: "carryToOpen",
    shrinkage: .3,
    shrinkagePlacement: "uniform",
    absenceShrinkage: 0,
    timeZone: "Asia/Kuwait",
    shifts: [{
      id: "AM",
      start: "09:30",
      end: "18:30",
      enabled: !0
    }, {
      id: "PM",
      start: "13:00",
      end: "22:00",
      enabled: !0
    }, {
      id: "MID",
      start: "11:00",
      end: "20:00",
      enabled: !1
    }],
    shiftsPerAgentPerWeek: 5,
    countryList: null,
    countryAliases: {},
    countries: null,
    pooling: "pooled",
    sharedVolumeMode: "proportional"
  };
}
function Rn(t) {
  return t && typeof t == "object" && !Array.isArray(t);
}
function ln(t, n) {
  if (!n) return Lt(t);
  const s = Lt(t);
  for (const [a, l] of Object.entries(n)) s[a] = Rn(l) && Rn(s[a]) ? ln(s[a], l) : Lt(l);
  return s;
}
function Lt(t) {
  return t === void 0 ? t : JSON.parse(JSON.stringify(t));
}
function ut(t, n = {}) {
  const s = String(t ?? "").trim();
  if (!s || s === "*") return "*";
  if (n[s]) return n[s];
  const a = Object.keys(n).find(l => l.toLowerCase() === s.toLowerCase());
  return a ? n[a] : s;
}
function Ss(t, n) {
  const s = n && n.countryAliases || {};
  return [...new Set(t.cells.map(a => ut(a.country, s)).filter(a => a !== "*"))].sort();
}
function rl(t, n, s) {
  const a = n.intervalMinutes,
    l = t.intervalMinutes || a;
  if (l % a !== 0 && a % l !== 0) throw new Error(`Upload interval ${l} min is incompatible with ${a} min`);
  const r = n.countryAliases || {},
    i = n.countryList && n.countryList.length ? n.countryList.slice() : Ss(t, n),
    h = new Set(i),
    p = s ? [s] : n.countries && n.countries.length ? n.countries : i,
    d = new Set(p),
    u = i.every(v => d.has(v));
  let c = 0,
    o = 0;
  for (const v of t.cells) {
    const y = ut(v.country, r);
    y === "*" || !h.has(y) || (o += v.volume, d.has(y) && (c += v.volume));
  }
  const f = o > 0 ? c / o : 0;
  let g;
  !s && !(n.countries && n.countries.length) ? g = 1 : n.sharedVolumeMode === "full" ? g = p.length ? 1 : 0 : o === 0 ? g = u ? 1 : 0 : n.sharedVolumeMode === "allOnly" ? g = u && !s ? 1 : 0 : g = f;
  const b = new Map();
  for (const v of t.cells) {
    const y = n.channels[v.channel];
    if (!y) continue;
    const w = ut(v.country, r);
    let M;
    if (w === "*" ? M = g : h.has(w) ? M = d.has(w) ? 1 : 0 : M = 0, M === 0 || !(v.volume > 0)) continue;
    const $ = v.ahtSec > 0 ? v.ahtSec : y.ahtSec,
      L = he(v.start),
      H = ks(v.day),
      O = l > a ? l / a : 1,
      T = l > a ? a : l;
    for (let S = 0; S < O; S++) {
      const C = l > a ? L + S * T : Math.floor(L / a) * a,
        q = `${v.channel}|${H}|${C}`,
        N = b.get(q) || {
          volume: 0,
          workSec: 0
        },
        E = v.volume * M / O;
      N.volume += E, N.workSec += E * $, b.set(q, N);
    }
  }
  return b;
}
function ol(t, n) {
  const s = [],
    a = new Set();
  for (const l of t.cells) n.channels[l.channel] || a.add(l.channel), l.volume >= 0 || s.push(`Negative or missing volume at ${l.channel} ${l.day} ${l.start}`);
  if (a.size && s.push(`Unknown channels (ignored): ${[...a].join(", ")}`), n.countryList && n.countryList.length) {
    const l = new Set(n.countryList),
      r = new Map();
    for (const i of t.cells) {
      const h = ut(i.country, n.countryAliases || {});
      h !== "*" && !l.has(h) && r.set(h, (r.get(h) || 0) + (i.volume || 0));
    }
    r.size && s.push(`Countries not in the country list (excluded; add them or an alias): ${[...r].map(([i, h]) => `${i} (${h.toFixed(1)}/wk-day vol)`).join(", ")}`);
  }
  return s;
}
function Ms(t, n = {}) {
  return n.slotMinutes > 0 ? n.slotMinutes : t.chats.slotMinutes > 0 ? t.chats.slotMinutes : (t.chats.conversationMin || 0) + (t.chats.noReplyTimeoutMin || 0);
}
function il(t) {
  const n = t.intervalMinutes,
    s = he(t.open),
    a = he(t.close),
    l = [];
  for (let r = s; r + n <= a; r += n) l.push(r);
  return l;
}
function Cs(t, n, s) {
  const a = n.intervalMinutes,
    l = a / 60,
    r = rl(t, n, s),
    i = il(n),
    h = i.length - 1,
    p = he(n.open),
    d = he(n.close),
    u = n.channels,
    c = Object.entries(u).filter(([, $]) => $.include !== !1),
    o = c.filter(([, $]) => $.kind === "call").map(([$]) => $),
    f = c.filter(([, $]) => $.kind === "chat").map(([$]) => $),
    g = c.filter(([, $]) => $.kind === "deferred").map(([$]) => $),
    m = ($, L, H) => r.get(`${$}|${L}|${H}`) || {
      volume: 0,
      workSec: 0
    },
    b = Array.from({
      length: 7
    }, () => ({
      before: {},
      after: {}
    })),
    v = {};
  for (const [$, L] of r) {
    const [H, O, T] = $.split("|"),
      S = +O,
      C = +T;
    if (C >= p && C + a <= d || !c.find(([N]) => N === H)) continue;
    v[H] = (v[H] || 0) + L.volume;
    const q = C < p ? b[S].before : b[S].after;
    q[H] = q[H] || {
      volume: 0,
      workSec: 0
    }, q[H].volume += L.volume, q[H].workSec += L.workSec;
  }
  const y = $ => Math.max(0, Math.floor((u[$].slaMin ?? 60) / a) - 1);
  let w = [];
  const M = [];
  for (let $ = 0; $ < 14; $++) {
    const L = $ % 7,
      H = $ * i.length,
      O = (L + 6) % 7;
    for (const S of g) {
      const C = [b[L].before[S], b[O].after[S]].filter(Boolean);
      for (const q of C) q.volume > 0 && w.push({
        id: S,
        rem: q.workSec / 3600,
        due: H + y(S),
        np: u[S].preemptible === !1
      });
    }
    const T = [];
    for (let S = 0; S < i.length; S++) {
      const C = i[S],
        q = H + S;
      let N = 0,
        E = 0;
      for (const B of o) {
        const te = m(B, L, C);
        N += te.volume, E += te.workSec;
      }
      const R = N > 0 ? E / N : 0,
        k = N / l,
        A = k * R / 3600,
        I = N > 0 ? ll(k, R, n.calls.slTarget, n.calls.answerWithinSec) : 0;
      let x = 0,
        P = 0,
        U = 0;
      for (const B of f) {
        const te = m(B, L, C),
          re = u[B].concurrency || n.chats.concurrency;
        U += te.volume, n.chats.model === "legacy" ? x += te.workSec / 3600 / l / (n.chats.ahtBasis === "effort" ? 1 : re) : (x += te.workSec / 3600 / l, P += te.volume / l * Ms(n, u[B]) / 60 / re);
      }
      const V = x / n.occupancyCap,
        de = {
          volume: U,
          effortAgents: x,
          effortHC: V,
          slotAgents: P,
          hc: Math.max(V, P),
          binding: U > 0 ? P > V + ie ? "slots" : "effort" : null
        };
      for (const B of g) {
        const te = m(B, L, C);
        if (te.workSec <= 0) continue;
        let re = q + y(B);
        n.overnight === "forceBeforeClose" && (re = Math.min(re, H + h)), w.push({
          id: B,
          rem: te.workSec / 3600,
          due: re,
          np: u[B].preemptible === !1
        });
      }
      w.sort((B, te) => B.due - te.due);
      let J = 0,
        se = 0;
      for (const B of w) B.due <= q && (B.np ? se += B.rem / l : J += B.rem / l);
      const Le = n.minOnFloor || 0;
      let ue = Math.max(I + se, (A + x + J + se) / n.occupancyCap, P, Le),
        Ee = n.occupancyCap * ue - (A + x + J + se),
        on = ue - I - se,
        St = J,
        Mt = se;
      for (const B of w) {
        if (B.due <= q) {
          B.rem = 0;
          continue;
        }
        const te = B.np ? Math.min(Ee, on) : Ee;
        if (te <= ie) continue;
        const re = Math.min(B.rem, te * l);
        B.rem -= re, Ee -= re / l, B.np ? (on -= re / l, Mt += re / l) : St += re / l;
      }
      w = w.filter(B => B.rem > ie);
      const cn = A + x + St + Mt;
      $ >= 7 && T.push({
        start: C,
        label: qe(C),
        calls: {
          volume: N,
          lambdaPerHour: k,
          ahtSec: R,
          A,
          N: I
        },
        chatAgents: x,
        chat: de,
        deferredServed: {
          preemptible: St,
          nonPreemptible: Mt
        },
        workload: cn,
        onFloor: ue,
        occupancy: ue > 0 ? cn / ue : 0,
        rostered: ue / (1 - n.shrinkage)
      });
    }
    n.overnight === "forceBeforeClose" && (w = []), $ >= 7 && M.push({
      day: kt[L],
      intervals: T
    });
  }
  return {
    intervalMinutes: a,
    slots: i,
    days: M,
    offHours: v
  };
}
function cl(t, n) {
  const s = n.countries && n.countries.length ? n.countries : Ss(t),
    a = s.map(i => Cs(t, n, i)),
    l = a[0],
    r = l.days.map((i, h) => ({
      day: i.day,
      intervals: i.intervals.map((p, d) => {
        const u = y => a.reduce((w, M) => w + M.days[h].intervals[d][y], 0),
          c = a.reduce((y, w) => y + w.days[h].intervals[d].calls.N, 0),
          o = a.reduce((y, w) => y + w.days[h].intervals[d].calls.A, 0),
          f = a.reduce((y, w) => y + w.days[h].intervals[d].calls.volume, 0),
          g = u("onFloor"),
          m = u("workload"),
          b = y => a.reduce((w, M) => w + (M.days[h].intervals[d].chat?.[y] || 0), 0),
          v = {
            volume: b("volume"),
            effortAgents: b("effortAgents"),
            effortHC: b("effortHC"),
            slotAgents: b("slotAgents")
          };
        return v.hc = Math.max(v.effortHC, v.slotAgents), v.binding = v.volume > 0 ? v.slotAgents > v.effortHC + ie ? "slots" : "effort" : null, {
          ...p,
          chat: v,
          calls: {
            ...p.calls,
            volume: f,
            A: o,
            N: c
          },
          chatAgents: u("chatAgents"),
          workload: m,
          onFloor: g,
          occupancy: g > 0 ? m / g : 0,
          rostered: u("rostered")
        };
      })
    }));
  return {
    ...l,
    days: r,
    perCountry: Object.fromEntries(s.map((i, h) => [i, a[h]]))
  };
}
function dl(t, n, s, a, l = {}) {
  const r = s / 60,
    i = a.map(m => n.map(b => m.startMin <= b && b + s <= m.endMin)),
    h = i.map(m => m.filter(Boolean).length * r),
    p = n.filter((m, b) => t[b] > ie && !i.some(v => v[b])),
    d = n.map((m, b) => b).filter(m => i.some(b => b[m])),
    u = a.map((m, b) => {
      let v = 0;
      return d.forEach(y => {
        i[b][y] && (v = Math.max(v, t[y]));
      }), Math.ceil(v - ie) + (l.flexible ? 1 : 0);
    }),
    c = l.flexible ? l.presence : t;
  let o = null;
  const f = new Array(a.length).fill(0),
    g = (m, b) => {
      if (!(o && b > o.total)) {
        if (m === a.length) {
          let v = 0;
          for (const y of d) {
            let w = 0;
            for (let M = 0; M < a.length; M++) i[M][y] && (w += f[M]);
            if (w + ie < c[y]) return;
            v += (w - c[y]) * r;
          }
          if (l.flexible) {
            const y = f.reduce((w, M, $) => w + M * h[$], 0);
            if (v + ie < l.shrinkage * y) return;
          }
          (!o || b < o.total || b === o.total && v < o.surplus - ie) && (o = {
            total: b,
            surplus: v,
            alloc: f.slice()
          });
          return;
        }
        for (let v = 0; v <= u[m]; v++) f[m] = v, g(m + 1, b + v);
        f[m] = 0;
      }
    };
  return g(0, 0), {
    ...(o || {
      total: 0,
      surplus: 0,
      alloc: f.slice()
    }),
    uncovered: p.map(qe)
  };
}
function hl(t, n) {
  const s = t.intervalMinutes,
    a = n.shifts.filter(r => r.enabled !== !1).map(r => ({
      id: r.id,
      startMin: he(r.start),
      endMin: he(r.end),
      paidHours: (he(r.end) - he(r.start)) / 60
    })),
    l = t.days.map(r => {
      const i = r.intervals.map(d => d.rostered),
        h = dl(i, t.slots, s, a, n.shrinkagePlacement === "flexible" ? {
          flexible: !0,
          presence: r.intervals.map(d => d.onFloor),
          shrinkage: n.shrinkage
        } : {}),
        p = t.slots.map(d => a.reduce((u, c, o) => u + (c.startMin <= d && d + s <= c.endMin ? h.alloc[o] : 0), 0));
      return {
        day: r.day,
        bodies: Object.fromEntries(a.map((d, u) => [d.id, h.alloc[u]])),
        total: h.total,
        coverage: p,
        uncovered: h.uncovered
      };
    });
  return {
    shifts: a,
    days: l
  };
}
function ul(t, n, s) {
  const a = t.intervalMinutes,
    l = a / 60,
    r = s.shiftsPerAgentPerWeek,
    i = s.absenceShrinkage || 0,
    h = n.days.reduce((T, S) => T + S.total, 0),
    p = h / r / (1 - i);
  let d = Math.ceil(p - ie);
  const u = Math.max(...n.days.map(T => T.total)),
    c = [];
  d < u && (c.push(`Peak day needs ${u} bodies but arithmetic gives ${d}; raised to ${u}.`), d = u);
  const o = n.days.filter(T => T.total >= d).map(T => T.day);
  o.length && c.push(`Zero slack (every hire working) on: ${o.join(", ")}.`);
  const f = n.days.flatMap(T => T.uncovered.map(S => `${T.day} ${S}`));
  f.length && c.push(`UNCOVERED intervals (no enabled shift): ${f.join(", ")}`);
  const g = n.shifts.map(T => {
    const S = n.days.map(N => N.bodies[T.id]),
      C = S.reduce((N, E) => N + E, 0),
      q = C / r / (1 - i);
    return {
      id: T.id,
      start: qe(T.startMin),
      end: qe(T.endMin),
      bodiesByDay: S,
      shiftDays: C,
      hiresExact: q,
      hiresIfFixed: Math.ceil(q - ie)
    };
  });
  let m = 0,
    b = 0,
    v = 0,
    y = 0,
    w = 0;
  t.days.forEach((T, S) => T.intervals.forEach((C, q) => {
    if (m += C.workload * l, b += C.onFloor * l, v += C.rostered * l, C.calls.volume > 0) {
      const N = n.days[S].coverage[q];
      let E = N * (1 - s.shrinkage);
      if (s.shrinkagePlacement === "flexible") {
        const A = t.days[S].intervals,
          I = n.days[S].coverage,
          x = A.reduce((U, V, de) => U + Math.max(0, I[de] - V.onFloor), 0),
          P = s.shrinkage * I.reduce((U, V) => U + V, 0);
        E = N - (x > 0 ? Math.max(0, N - C.onFloor) / x * P : 0);
      }
      const R = Math.floor(E - C.deferredServed.nonPreemptible + ie),
        k = ws(C.calls.lambdaPerHour, C.calls.ahtSec, R, s.calls.answerWithinSec);
      y += C.calls.volume, w += C.calls.volume * k.sl;
    }
  }));
  const M = n.days.reduce((T, S) => T + n.shifts.reduce((C, q) => C + S.bodies[q.id] * q.paidHours, 0), 0),
    $ = h > 0 ? M / h : 0,
    L = d * r * $,
    H = b > 0 ? m / b : 0,
    O = H >= .75 ? "workload-driven" : H < .4 ? "coverage-driven" : "mixed";
  return {
    hires: d,
    hiresExact: p,
    shiftDays: h,
    peakDay: u,
    perShift: g,
    warnings: c,
    hours: {
      work: m,
      onFloor: b,
      rostered: v,
      scheduled: M,
      hired: L
    },
    uplift: {
      occupancyAndErlang: m > 0 ? b / m : 0,
      shrinkage: b > 0 ? v / b : 0,
      shiftShapeAndRounding: v > 0 ? M / v : 0,
      hireRounding: M > 0 ? L / M : 0,
      total: m > 0 ? L / m : 0
    },
    occupancy: H,
    regime: O,
    chatBinding: t.days.reduce((T, S) => (S.intervals.forEach(C => {
      const q = C.chat?.binding;
      q && T[q]++;
    }), T), {
      effort: 0,
      slots: 0
    }),
    realisedCallSL: y > 0 ? w / y : null
  };
}
function As(t, n) {
  const s = ln(xs(), n),
    a = s.pooling === "dedicated" ? cl(t, s) : Cs(t, s),
    l = hl(a, s),
    r = ul(a, l, s);
  return s.pooling === "dedicated" && (r.realisedCallSL = null), {
    assumptions: s,
    requirement: a,
    roster: l,
    headcount: r,
    problems: ol(t, s)
  };
}
function rn(t) {
  const n = [];
  let s = [],
    a = "",
    l = !1;
  for (let r = 0; r < t.length; r++) {
    const i = t[r];
    l ? i === '"' ? t[r + 1] === '"' ? (a += '"', r++) : l = !1 : a += i : i === '"' ? l = !0 : i === "," ? (s.push(a), a = "") : i === `
` || i === "\r" ? (i === "\r" && t[r + 1] === `
` && r++, s.push(a), n.push(s), s = [], a = "") : a += i;
  }
  return (a !== "" || s.length) && (s.push(a), n.push(s)), n;
}
const pl = {
  inbound: "inbound_calls",
  "inbound calls": "inbound_calls",
  calls: "inbound_calls",
  "call center": "inbound_calls",
  "social media": "social_media",
  social: "social_media",
  "in-app": "in_app",
  "in app": "in_app",
  "live chat": "in_app",
  "chat with us": "in_app",
  wa: "waiting_address",
  "waiting address": "waiting_address",
  "customer didn't answer": "customer_didnt_answer",
  "customer didnt answer": "customer_didnt_answer",
  "internal tickets": "internal_tickets",
  tickets: "internal_tickets"
};
function $s(t) {
  const n = String(t).trim().toLowerCase().replace(/\s+/g, " ");
  return pl[n] || n.replace(/[^a-z0-9]+/g, "_");
}
function ml(t, n = 60) {
  const s = rn(t).filter(o => o.some(f => f.trim() !== "")),
    a = s[0].map(o => o.trim().toLowerCase()),
    l = o => {
      const f = a.indexOf(o);
      if (f < 0) throw new Error(`Missing column "${o}"`);
      return f;
    },
    [r, i, h, p, d] = ["country", "channel", "day", "interval", "volume"].map(l),
    u = a.indexOf("aht_sec"),
    c = s.slice(1).map(o => ({
      country: o[r].trim() || "*",
      channel: $s(o[i]),
      day: kt[ks(o[h])],
      start: qe(he(isNaN(+o[p]) ? o[p] : +o[p])),
      volume: Number(o[d]) || 0,
      ...(u >= 0 && o[u] !== "" ? {
        ahtSec: Number(o[u])
      } : {})
    }));
  return {
    intervalMinutes: n,
    cells: c
  };
}
function Ts(t, {
  country: n = "*",
  intervalMinutes: s = 60
} = {}) {
  const a = rn(t),
    l = a[1] || [],
    r = [],
    i = {};
  let h = "";
  const p = (a[0] || []).map(d => (d && d.trim() && (h = d.trim()), h));
  l.forEach((d, u) => {
    if (String(d).trim().toLowerCase() !== "interval") return;
    const c = p[u] || `block_${u}`,
      o = $s(c);
    for (let f = 2; f < a.length; f++) {
      const g = (a[f][u] || "").trim();
      if (g === "" || isNaN(Number(g))) {
        if (g === "") break;
        continue;
      }
      for (let m = 0; m < 7; m++) {
        const b = (a[f][u + 1 + m] || "").trim(),
          v = Number(b);
        b !== "" && !isNaN(v) && r.push({
          country: n,
          channel: o,
          day: kt[m],
          start: qe(Math.round(Number(g) * 60)),
          volume: v
        });
      }
    }
  });
  for (let d = 0; d < (a[0] || []).length; d++) if (String(a[0][d]).trim().toLowerCase() === "queue" && String(a[0][d + 1]).trim().toLowerCase() === "aht") for (let u = 1; u < a.length; u++) {
    const c = (a[u][d] || "").trim(),
      o = Number(a[u][d + 1]);
    c && !isNaN(o) && (i[c] = o);
  }
  return {
    intervalMinutes: s,
    cells: r,
    ahtMinutes: i
  };
}
function Ut(t, n) {
  let s = t;
  for (const a of n) {
    if (s === null || typeof s != "object") return;
    s = s[a];
  }
  return s;
}
function Vt(t, n, s) {
  const [a, ...l] = n,
    r = {
      ...t
    };
  if (!l.length) return s === void 0 ? delete r[a] : r[a] = s, r;
  const i = r[a] && typeof r[a] == "object" && !Array.isArray(r[a]) ? r[a] : {};
  return r[a] = Vt(i, l, s), r;
}
function fl(t) {
  const n = new Set();
  return t.map(s => (s.forEach((a, l) => {
    String(a).trim().toLowerCase() === "interval" && n.add(l);
  }), s.map((a, l) => {
    let r = String(a ?? "");
    const i = Number(r);
    if (n.has(l) && r !== "" && i > 0 && i < 1) {
      const h = Math.round(i * 1440);
      r = `${String(Math.floor(h / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
    }
    return /[",\n\r]/.test(r) ? `"${r.replace(/"/g, '""')}"` : r;
  }).join(","))).join(`
`);
}
function gl(t) {
  const n = (t[0] ?? []).map(s => String(s).trim().toLowerCase());
  return ["country", "channel", "day", "interval", "volume"].every(s => n.includes(s)) ? "long" : (t[1] ?? []).some(s => String(s).trim().toLowerCase() === "interval") ? "wide" : "unknown";
}
const qs = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  Os = [9, 10, 11, 12, 13, 14],
  pt = {
    Inbound: [[6, 7, 8, 6, 7, 7, 5], [9, 10, 11, 9, 10, 10, 8], [10, 11, 12, 10, 11, 11, 9], [8, 9, 10, 8, 9, 9, 7], [7, 8, 9, 7, 8, 8, 6], [7, 8, 8, 7, 8, 8, 6]],
    WA: [[4, 4, 4, 4, 5, 5, 4], [5, 5, 6, 5, 6, 6, 5], [6, 6, 6, 6, 7, 7, 5], [5, 5, 5, 5, 6, 6, 5], [4, 4, 5, 4, 5, 5, 4], [4, 4, 4, 4, 5, 5, 4]]
  };
function Kt() {
  const t = ["country,channel,day,interval,volume,aht_sec"];
  for (const n of Object.keys(pt)) Os.forEach((s, a) => {
    qs.forEach((l, r) => {
      t.push(`Kuwait,${n},${l},${String(s).padStart(2, "0")}:00,${pt[n][a][r]},${n === "Inbound" ? 240 : 150}`);
    });
  });
  return t.join(`
`);
}
function Ls() {
  const t = Object.keys(pt),
    n = "",
    s = [],
    a = [];
  t.forEach((r, i) => {
    s.push(r, ...Array(7).fill(n)), a.push("Interval", ...qs), i < t.length - 1 && (s.push(n), a.push(n));
  });
  const l = Os.map((r, i) => {
    const h = [];
    return t.forEach((p, d) => {
      h.push(r, ...pt[p][i]), d < t.length - 1 && h.push(n);
    }), h.join(",");
  });
  return [s.join(","), a.join(","), ...l].join(`
`);
}
function je(t, n) {
  const s = URL.createObjectURL(new Blob([n], {
      type: "text/csv;charset=utf-8"
    })),
    a = document.createElement("a");
  a.href = s, a.download = t, a.click(), setTimeout(() => URL.revokeObjectURL(s), 1e3);
}
const Re = "__other__";
const _l = {
    calls: ["inbound_calls"],
    inbound: ["inbound_calls"],
    chats: ["social_media", "in_app"],
    "social media": ["social_media"],
    "in-app": ["in_app"],
    wa: ["waiting_address"],
    "waiting address": ["waiting_address"],
    "customer didn't answer": ["customer_didnt_answer"],
    tickets: ["internal_tickets"],
    "internal tickets": ["internal_tickets"],
    escalations: ["internal_tickets"]
  },
  mt = t => (Math.round(t * 10) / 10).toLocaleString("en-GB", {
    maximumFractionDigits: 1
  });
