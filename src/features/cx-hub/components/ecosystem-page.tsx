'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/**
 * Zb — Hub ecosystem page, verbatim port of the legacy closure
 * (`.devin/work/extract/hub/pages/ecosystem.closure.js`).
 *
 * The legacy bundle embedded three.js r186; the scene lives in
 * `./ecosystem-scene` and is lazy-loaded via `next/dynamic` so three.js
 * stays out of the route's initial bundle (PERF-1).
 */
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import {
  Eo,
  Ft,
  fetchJson,
  Pr,
} from '@/features/cx-hub/components/hub-shared'
import { PAGES } from '@/features/shared/components/shell/registry'
import { Button } from '@/features/shared/components/ui'
import { appForGroup, groupEntryLink } from '@/features/shared/shell/gates'

const Scene3D = dynamic(
  () => import('./ecosystem-scene').then(m => m.Scene3D),
  {
    ssr: false,
    loading: () => (
      <div className="eco3-page-msg">
        <p>Loading the ecosystem…</p>
      </div>
    ),
  }
)

const As = {
  url: 'https://cdn.jsdelivr.net/gh/LukaArambasic/three-js@31a779de0929e77ee5da5f5eff8e99eec2144b2e/video3/public/scene.gltf',
  author: 'eb78',
  authorUrl: 'https://sketchfab.com/E.A.Cornell',
  source: 'https://sketchfab.com/3d-models/camel-99af7daa5baf450ea7b809937937e6d5',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

// ---------------------------------------------------------------------------
// Shell/nav helpers (ported from the closure, bound to the unified registry)
// ---------------------------------------------------------------------------
const Kb = 300 * 1e3

const Lr = (n: string) => `/${n}`

const Hr = 'hub'

const Ng = {
  get: () => fetchJson<any>('/api/hub/ecosystem'),
}

function Um(n: any) {
  return n.isOwner === !0
}

function rh(n: any, e: any) {
  const {
    user: t,
  } = e
  if (!n.roles.includes(t.role)) return !1
  const i = !!e.quality?.auditor
  switch (n.path) {
    case 'my-day':
    case 'notes':
      return Um(e)
    case 'coaching':
      return t.role !== 'agent' || !!t.specialist
    case 'aging':
      return !t.specialist
    case 'audit-queue':
    case 'my-auditor-kpis':
      return i
    case 'my-audits':
      return !t.specialist
    case 'disputes':
      return !0
    case 'calibration':
      return t.role !== 'agent' || i
    case 'kb-gaps':
      return t.role !== 'agent' || i || !!e.quality?.kbEditor
    default:
      return !0
  }
}

function ec(n: any, e: any) {
  return n.group === 'quality' && !e.quality ? n.roles.includes(e.user.role) : rh(n, e)
}

function im(n: any) {
  if (!n.missing && n.href) {
    if (n.external) {
      window.open(n.href, '_top')
    } else {
      location.assign(n.href)
    }
  }
}

function lm(n: string, e: (t: any) => boolean) {
  return n === 'hub' ? 'overview' : PAGES.find(t => t.group === n && e(t))?.path ?? 'overview'
}

function yf(n: string, e: any[], t: (a: any) => boolean) {
  const i = e.find(a => a.group === n && t(a))
  if (!i) return null
  const app = appForGroup(n),
    r = n !== 'hub' && app && (globalThis as any)
  void r
  return groupEntryLink(n, PAGES, t)
}

function Jb({ boot: n, msg: e, setMsg: t }: { boot: any; msg: string; setMsg: (m: string) => void }) {
  const {
    data: i,
    error: s,
    reload: r,
  } = Eo(Ng.get)
  return useEffect(() => {
    const o = setInterval(() => {
      if (!document.hidden) r()
    }, Kb)
    return () => clearInterval(o)
  }, [r]), <><a className="skip" href="#main">Skip to content</a><main id="main" className="eco3-page" tabIndex={-1}>{i ? <Scene3D health={i} onSelect={o => {
    if (appForGroup(o) !== Hr) {
      const c = yf(o, PAGES as any[], l => ec(l, n))
      if (c && !c.missing) {
        im(c)
      } else {
        t(c ? 'That app is not connected yet. An admin adds its web app URL in Admin, Settings.' : 'You have no page in that system.')
      }
      return
    }
    location.href = Lr(lm(o, c => rh(c, n)))
  }} /> : <div className="eco3-page-msg">{s ? <Ft><p>Ecosystem health did not load: {s}</p><Button className="btn" onClick={r}>Try again</Button></Ft> : <p>Loading the ecosystem…</p>}</div>}<header className="eco3-head"><h1>Ecosystem</h1>{i?.asOf ? <span>Health as of {new Date(i.asOf).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}</span> : null}{e ? <span role="status">{e}</span> : null}<nav aria-label="Ecosystem"><a className="eco3-home" href={Lr('overview')}>Hub home</a></nav><small className="eco3-credit"><a className="cx-link" href={As.source} target="_blank" rel="noopener noreferrer">Camel model</a>{' by'}{' '}<a className="cx-link" href={As.authorUrl} target="_blank" rel="noopener noreferrer">{As.author}</a>,{' '}<a className="cx-link" href={As.licenceUrl} target="_blank" rel="noopener noreferrer">{As.licence}</a></small></header></main></>
}

/** Zb — ecosystem page component (verbatim port). */
export function EcosystemPage() {
  const e = Pr(),
    t = e?.user.role === 'admin' || e?.user.role === 'tl',
    [i, s] = useState('')
  return useEffect(() => {
    const r = document.title
    return document.title = 'Ecosystem, Dabdoob CX', () => {
      document.title = r
    }
  }, []), !e || !t ? <><a className="skip" href="#main">Skip to content</a><main id="main" className="eco3-page" tabIndex={-1}><div className="eco3-page-msg"><p>The ecosystem map is for team leads and admins.</p><a className="cx-link" href={Lr('overview')}>Go to Hub home</a></div></main></> : <Jb boot={e} msg={i} setMsg={s} />
}
