/**
 * Maqsam Calls API v2 client — GET https://api.{base_url}/v2/calls, Basic auth
 * (access_key_id:access_secret), 100 calls per page.
 * Env: MAQSAM_API_KEY, MAQSAM_API_SECRET, MAQSAM_DOMAIN (the "base_url" from
 * Maqsam Account Settings > API Credentials — with or without the api. prefix).
 */

import 'server-only'
import { described } from '@/features/shared/lib/errors'
import { vendorJson } from './http'

export interface MaqsamCreds {
  key: string
  secret: string
  /** e.g. api.dabdoob.maqsam.com/v2 */
  base: string
}

export interface MaqsamCall {
  [k: string]: unknown
}

export function maqsamCredsFromEnv(): MaqsamCreds | null {
  const key = process.env.MAQSAM_API_KEY
  const secret = process.env.MAQSAM_API_SECRET
  const domain = process.env.MAQSAM_DOMAIN
  if (!key || !secret || !domain) return null
  return { key, secret, base: maqsamBase(domain) }
}

/** 'dabdoob' | 'dabdoob.maqsam.com' | 'api.mq.maqsam.com' | 'host/v2/calls' | URL -> api.<host>/v2 */
export function maqsamBase(domain: string): string {
  let d = String(domain).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  d = d.split('/')[0] // host only — the env var may already carry /v2/calls
  if (d.startsWith('api.')) d = d.slice(4)
  if (!d.includes('.')) d = `${d}.maqsam.com`
  return `api.${d}/v2`
}

/**
 * Calls created in [startMs, endMs) — pages of 100 until a short page or
 * maxPages. Success body is { result:'success', message: [calls] } per the
 * Maqsam docs; a bare array / calls / data keys are tolerated for shape drift.
 */
export async function listMaqsamCalls(
  creds: MaqsamCreds,
  opts: { startMs?: number; endMs?: number; maxPages?: number } = {}
): Promise<MaqsamCall[]> {
  const auth = Buffer.from(`${creds.key}:${creds.secret}`).toString('base64')
  const out: MaqsamCall[] = []
  const maxPages = Math.max(1, opts.maxPages ?? 600)
  const CONCURRENCY = 5 // pages arrive ~3s apart serially — batches cut wall time
  const fetchPage = async (page: number): Promise<MaqsamCall[]> => {
    const q = new URLSearchParams({ page: String(page) })
    if (opts.startMs) q.set('start_time', String(Math.floor(opts.startMs / 1000)))
    if (opts.endMs) q.set('end_time', String(Math.floor(opts.endMs / 1000)))
    try {
      const data = await vendorJson(`https://${creds.base}/calls?${q}`, { headers: { authorization: `Basic ${auth}` } }, 'maqsam')
      const body = data as { result?: string; message?: unknown; error?: boolean; calls?: MaqsamCall[]; data?: MaqsamCall[]; results?: MaqsamCall[] }
      if (body && body.error) {
        throw described(new Error(`maqsam API error: ${typeof body.message === 'string' ? body.message : 'unknown'}`), { step: 'maqsam API request' })
      }
      return Array.isArray(data)
        ? (data as MaqsamCall[])
        : Array.isArray(body.message)
          ? (body.message as MaqsamCall[])
          : body.calls || body.data || body.results || []
    } catch (e) {
      // Overshooting the last page 400s with 'Invalid Page Number' — treat as end-of-data.
      if (/invalid page number/i.test((e as Error).message)) return []
      throw e
    }
  }
  for (let page = 1; page <= maxPages; page += CONCURRENCY) {
    const batch = await Promise.all(Array.from({ length: Math.min(CONCURRENCY, maxPages - page + 1) }, (_, i) => fetchPage(page + i)))
    let done = false
    for (const calls of batch) {
      out.push(...calls)
      if (calls.length < 100) done = true // short/empty page: nothing newer follows
    }
    if (done) break
  }
  if (out.length >= maxPages * 100) {
    // Hit the cap on a full last page — more calls exist. Throwing beats
    // silently truncating a sync window.
    throw described(new Error(`maqsam API page cap (${maxPages}) reached — the sync window is too dense`), { step: 'maqsam API request' })
  }
  return out
}
