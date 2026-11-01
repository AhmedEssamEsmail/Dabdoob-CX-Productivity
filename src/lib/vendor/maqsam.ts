/**
 * Maqsam Calls API v2 client — GET https://api.{base_url}/v2/calls, Basic auth
 * (access_key_id:access_secret), 100 calls per page.
 * Env: MAQSAM_API_KEY, MAQSAM_API_SECRET, MAQSAM_DOMAIN (the "base_url" from
 * Maqsam Account Settings > API Credentials — with or without the api. prefix).
 */

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
 * maxPages. Response is { calls: [...] } on current docs; a bare array is
 * tolerated for shape drift.
 */
export async function listMaqsamCalls(
  creds: MaqsamCreds,
  opts: { startMs?: number; endMs?: number; maxPages?: number } = {}
): Promise<MaqsamCall[]> {
  const auth = Buffer.from(`${creds.key}:${creds.secret}`).toString('base64')
  const out: MaqsamCall[] = []
  const maxPages = Math.max(1, opts.maxPages ?? 600)
  for (let page = 1; page <= maxPages; page++) {
    const q = new URLSearchParams({ page: String(page) })
    if (opts.startMs) q.set('start_time', String(Math.floor(opts.startMs / 1000)))
    if (opts.endMs) q.set('end_time', String(Math.floor(opts.endMs / 1000)))
    const data = await vendorJson(`https://${creds.base}/calls?${q}`, { headers: { authorization: `Basic ${auth}` } }, 'maqsam')
    const calls = Array.isArray(data)
      ? (data as MaqsamCall[])
      : ((data as { calls?: MaqsamCall[]; data?: MaqsamCall[]; results?: MaqsamCall[] }).calls ||
          (data as { data?: MaqsamCall[] }).data ||
          (data as { results?: MaqsamCall[] }).results ||
          [])
    if (!calls.length) break
    out.push(...calls)
    if (calls.length < 100) break
  }
  return out
}
