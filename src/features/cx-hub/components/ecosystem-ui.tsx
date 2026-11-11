'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/**
 * Ecosystem 3D overlay UI (verbatim port, split from `ecosystem-scene.tsx`):
 * the per-system tag buttons + camel label and the time/rotate dock.
 */
import { type RefObject } from 'react'

import { Ft } from '@/features/cx-hub/components/hub-shared'
import { _r, Hb, ia, vu, xu, zb } from './ecosystem-data'

export function Eco3Tags(n: {
  health: any
  hot: string | null
  camelId: string | null
  tagRefs: Record<string, HTMLButtonElement | null>
  camelRef: RefObject<HTMLDivElement | null>
  onHover: (v: any) => void
  onFocus: (id: string | null) => void
  onPick: (id: string) => void
}) {
  const {
    health: e,
    hot: w,
    camelId: S,
    tagRefs,
    camelRef,
    onHover: h,
    onFocus: d,
    onPick: b,
  } = n
  return <div className="eco3-tags">{_r.map(_ => {
    const T = e.nodes[_],
      R = w === _
     
    return <button key={_} type="button" ref={D => {
      tagRefs[_] = D
    }} className={`eco3-tag eco3-s-${T.state}${R ? ' is-hot' : ''}${_ === 'hub' ? ' eco3-tag--hub' : ''}`} aria-label={`${ia[_]}, ${vu[T.state]}. Last run ${xu(T.lastRun)}. Opens ${ia[_]}.`} onPointerEnter={() => h({
      kind: 'node',
      id: _,
    })} onPointerLeave={() => h(null)} onFocus={() => d(_)} onBlur={() => d(null)} onClick={() => b(_)}><span className="eco3-tag-name"><i className="eco3-dot" aria-hidden="true" />{ia[_]}</span>{R || T.state === 'warn' || T.state === 'down' ? <span className="eco3-tag-state">{vu[T.state]}{T.note ? `: ${T.note}` : ''}</span> : null}</button>
  })}<div ref={camelRef} className={`eco3-tag eco3-tag--camel${S ? ` eco3-s-${e.nodes[S].state}` : ''}`} aria-hidden="true" style={{
    visibility: 'hidden',
  }}>{S ? <Ft><span className="eco3-tag-name"><i className="eco3-dot" />{ia[S]}</span><span className="eco3-tag-state">Last run {xu(e.nodes[S].lastRun)}</span></Ft> : null}</div></div>
}

export function Eco3Dock(n: {
  hours: number
  now: boolean
  autoRotate: boolean
  onTime: (h: number) => void
  onNow: () => void
  onAutoRotate: () => void
}) {
  const {
    hours: y,
    now: p,
    autoRotate: m,
    onTime,
    onNow,
    onAutoRotate,
  } = n
  return <div className="eco3-dock"><label className="eco3-time"><span className="eco3-clock"><b>{Hb(y)}</b>{' '}{zb(y)}</span>{ }<input type="range" min="0" max="24" step="0.25" value={y} aria-label="Time of day in the scene" onInput={_ => {
    onTime(Number(_.currentTarget.value))
  }} /></label>{ }<button type="button" className="eco3-btn" aria-pressed={p} onClick={onNow} title="Follow your clock">Now</button>{ }<button type="button" className="eco3-btn" aria-pressed={m} onClick={onAutoRotate}>Auto-rotate</button></div>
}
