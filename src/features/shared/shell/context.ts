'use client'

import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Bootstrap data + shell API client.
 *
 * Legacy fed the shell from `window.__CC_BOOT__` or a `google.script.run`
 * `getBootstrap` call. Here the same object comes from `window.__CC_BOOT__`
 * (when a server inline-script provides it) or `GET /api/bootstrap`, with a
 * safe fallback until the real bootstrap endpoint lands (WP-B owns /api/*).
 */

export interface ShellUser {
  role: 'admin' | 'tl' | 'agent' | 'unknown' | string
  name: string
  email: string
  specialist?: boolean
}

export interface ShellPopup {
  id: string
  kind: string
  title: string
  body: string
  createdAt?: string
  link?: string
}

export interface ViewAsPerson {
  name: string
  email: string
  role: 'admin' | 'tl' | 'agent' | string
  position?: string
  tlName?: string
  auditor?: boolean
}

export interface OneOnOneAlert {
  key: string
  type: 'soon' | 'start'
  scheduleId: string
  startAt: string
  durationMin: number
  withName: string
  holder?: boolean
  link?: string
}

export interface Bootstrap {
  user: ShellUser
  isOwner?: boolean
  quality?: { auditor?: boolean; kbEditor?: boolean }
  viewAs?: { canUse?: boolean; target?: ShellUser | null }
  popups: ShellPopup[]
  appUrls?: Record<string, string>
}

/** Server-compatible fallback while the real bootstrap endpoint is pending. */
export const FALLBACK_BOOT: Bootstrap = {
  user: { role: 'admin', name: 'CX Admin', email: 'admin@dabdoob.com' },
  isOwner: true,
  viewAs: { canUse: true, target: null },
  popups: [],
  appUrls: {},
}

interface GasUrlLocator {
  getLocation: (fn: (location: { parameter: Record<string, string> }) => void) => void
}

declare global {
  interface Window {
    __CC_BOOT__?: Bootstrap
    google?: { script?: { url?: GasUrlLocator } }
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${response.status}`)
  return (await response.json()) as T
}

async function sendJson<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${response.status}`)
  return (await response.json().catch(() => ({}))) as T
}

/** ye — the shell-level endpoints, now plain REST with graceful failure. */
export const shellApi = {
  getBootstrap: (): Promise<Bootstrap> => getJson<Bootstrap>('/api/bootstrap'),
  getViewAsPeople: (): Promise<ViewAsPerson[]> => getJson<ViewAsPerson[]>('/api/view-as/people'),
  startViewAs: (email: string) => sendJson('/api/view-as', { email }),
  stopViewAs: () => sendJson('/api/view-as', undefined, 'DELETE'),
  getViewAsState: (): Promise<{ target?: ShellUser | null }> => getJson('/api/view-as'),
}

/** st — alerts/popups polling endpoints. Errors are swallowed by callers. */
export const alertsApi = {
  oneOnOneAlerts: () => getJson<{ alerts: OneOnOneAlert[] }>('/api/alerts/one-on-one'),
  oneOnOneAlertsSeen: (keys: string[]) =>
    sendJson('/api/alerts/one-on-one', { keys }),
  popupsPoll: () => getJson<{ popups: ShellPopup[] }>('/api/popups'),
}

/** Load the bootstrap: `__CC_BOOT__` wins, then /api/bootstrap, else fallback. */
export async function loadBootstrap(): Promise<Bootstrap> {
  const inline = window.__CC_BOOT__
  delete window.__CC_BOOT__
  if (inline) return inline
  try {
    return await shellApi.getBootstrap()
  } catch {
    return FALLBACK_BOOT
  }
}

/* --- gn()/ea()/ta() — tiny module store so any component can read the boot --- */

let boot: Bootstrap | null = null // fn
const bootListeners = new Set<() => void>() // rt

export function getBoot(): Bootstrap | null {
  return boot
}

export function setBoot(next: Bootstrap | null): void {
  boot = next
  bootListeners.forEach((fn) => fn())
}

export function subscribeBoot(fn: () => void): () => void {
  bootListeners.add(fn)
  return () => {
    bootListeners.delete(fn)
  }
}

/** ta() — subscribe to a derived slice of the boot object. */
export function useBootSelector<T>(selector: () => T, deps: unknown[] = []): T {
  const [value, setValue] = useState<T>(selector)
  useEffect(() => {
    const update = () => setValue(() => selector())
    const off = subscribeBoot(update)
    update()
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

const BootContext = createContext<Bootstrap | null>(null)

export const BootProvider = BootContext.Provider

export function useBoot(): Bootstrap | null {
  return useContext(BootContext)
}
