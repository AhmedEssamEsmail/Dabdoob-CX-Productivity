'use client'

import { useEffect, useState } from 'react'
import ar from '../../../../specs/legacy-parity/data/legacy-i18n-ar.json'

/**
 * Port of the legacy appearance + i18n helpers:
 *   la = 'cx.appearance' storage key, It = defaults, ca() reader, ia() apply,
 *   ct/oa change subscription, _n() reduce-motion check, ps dictionary,
 *   D() translate+interpolate, ms() lang hook.
 */

export const APPEARANCE_KEY = 'cx.appearance' // la

export interface Appearance {
  theme: 'auto' | 'light' | 'dark' | string
  accent: 'pine' | string
  solid: boolean
  still: boolean
  lang: 'en' | 'ar' | string
}

export const APPEARANCE_DEFAULTS: Appearance = {
  theme: 'auto',
  accent: 'pine',
  solid: false,
  still: false,
  lang: 'en',
} // It

/** ca() */
export function readAppearance(): Appearance {
  try {
    return { ...APPEARANCE_DEFAULTS, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}') }
  } catch {
    return APPEARANCE_DEFAULTS
  }
}

const listeners = new Set<() => void>() // ct

/** oa() — subscribe to appearance changes applied via applyAppearance(). */
export function onAppearanceChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** ia() — push the stored appearance onto <html>. */
export function applyAppearance(t: Appearance): void {
  const n = document.documentElement
  if (t.theme === 'auto') n.removeAttribute('data-theme')
  else n.setAttribute('data-theme', t.theme)
  if (t.accent === 'pine') n.removeAttribute('data-accent')
  else n.setAttribute('data-accent', t.accent)
  n.toggleAttribute('data-reduce-transparency', t.solid)
  n.toggleAttribute('data-reduce-motion', t.still)
  n.lang = t.lang
  n.dir = t.lang === 'ar' ? 'rtl' : 'ltr'
  queueMicrotask(() => listeners.forEach((fn) => fn()))
}

/** _n() — true when motion should be suppressed. */
export function prefersReducedMotion(): boolean {
  return (
    (typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.documentElement.hasAttribute('data-reduce-motion')
  )
}

const ps: Record<string, string> = ar

/** D() — translate to Arabic when <html lang="ar">, with {key} interpolation. */
export function D(t: string, n?: Record<string, string>): string {
  const a = (document.documentElement.lang === 'ar' && ps[t]) || t
  return n ? a.replace(/\{(\w+)\}/g, (s, l) => n[l] ?? s) : a
}

/** ms() — re-render when the document language changes. */
export function useLang(): string {
  const [lang, setLang] = useState(() =>
    typeof document === 'undefined' ? 'en' : document.documentElement.lang
  )
  useEffect(
    () =>
      onAppearanceChange(() => {
        setLang(document.documentElement.lang)
      }),
    []
  )
  return lang
}
