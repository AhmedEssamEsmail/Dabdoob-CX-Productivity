'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

/**
 * Ecosystem page data + formatters (verbatim port helpers split from
 * `ecosystem-scene.tsx`): node lists, the status palettes shared with the
 * three.js scene, age/time formatters, and the WebGL/reduced-motion probes.
 */
import { Gs } from '@/features/cx-hub/components/hub-shared'

export function Hb(n: number) {
  const e = Math.round((n % 24 + 24) % 24 * 60) % 1440
  return `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`
}

export const Jd = Gs

export function Yb() {
  try {
    const n = document.createElement('canvas').getContext('webgl2')
    return n ? (n.getExtension('WEBGL_lose_context')?.loseContext(), !0) : !1
  } catch {
    return !1
  }
}

export const _r = ['hub', 'quality', 'productivity', 'queue', 'desk', 'people', 'operations', 'fcr'],
  ei = ['quality', 'productivity', 'queue', 'desk', 'people', 'operations', 'fcr'],
  ia: Record<string, string> = {
    hub: 'Main Hub',
    quality: 'Quality',
    productivity: 'Productivity',
    queue: 'Queue & Workforce',
    people: 'People & Performance',
    operations: 'Operations & Trackers',
    fcr: 'FCR',
    desk: 'TL Desk',
  },
  vu: Record<string, string> = {
    ok: 'Healthy',
    warn: 'Warning',
    down: 'Down',
    idle: 'Idle',
  },
  // kept raw: WebGL/Three.js palette values cannot consume CSS custom properties.
  tr: Record<string, string> = {
    ok: '#86ab98',
    warn: '#c2a878',
    down: '#c98f88',
    idle: '#8d97a5',
  },
  sa: Record<string, number> = {
    ok: 1,
    warn: 1,
    down: 0.72,
    idle: 0.58,
  }

export function xu(n: any) {
  if (!n) return 'never'
  const e = Date.parse(n)
  if (Number.isNaN(e)) return n
  const t = Math.round((Date.now() - e) / 6e4)
  if (t < 1) return 'just now'
  if (t < 60) return `${t} min ago`
  const i = Math.round(t / 60)
  return i < 48 ? `${i} h ago` : `${Math.round(i / 24)} d ago`
}

export function zb(n: number) {
  const e = (n % 24 + 24) % 24
  return e < 5 ? 'Night' : e < 8 ? 'Dawn' : e < 11 ? 'Morning' : e < 14.5 ? 'Midday' : e < 17.3 ? 'Afternoon' : e < 19.4 ? 'Sunset' : 'Night'
}
