/**
 * My day — the Google seam (Assistant.js CalendarApp / Gmail advanced service /
 * DriveApp reads).
 *
 * Everything Google the assistant touches — his calendar events, Gmail thread
 * metadata and Drive file list — goes through this one adapter. When the
 * service-account creds (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY,
 * domain-wide delegation subject = the assistant owner) are absent, the
 * adapter reports { configured: false } and every caller surfaces the legacy
 * section error envelope; no Google data is ever fabricated.
 */

import 'server-only'

export interface GoogleThreadMessage {
  internalDate?: string
  labelIds?: string[]
  payload?: { headers?: { name: string; value: string }[] }
}

export interface GoogleThread {
  id?: string
  messages?: GoogleThreadMessage[]
}

export interface GoogleCalEvent {
  id?: string
  title: string
  start: number
  end: number
  allDay: boolean
  location: string
  myStatus: string
  guests: number
}

export interface GoogleDriveFile {
  id: string
  name: string
  webViewLink?: string
  mimeType?: string
  modifiedTime?: string
}

export interface MyDayGoogle {
  configured: boolean
  /** Gmail.Users.Threads.list -> thread ids. */
  listThreads(q: string, maxResults: number): Promise<string[]>
  /** Gmail.Users.Threads.get metadata for ids (asGmailThreads_). */
  getThreads(ids: string[], headers: string[]): Promise<GoogleThread[]>
  /** CalendarApp.getDefaultCalendar().getEvents(start, end). */
  calendarEvents(start: Date, end: Date): Promise<GoogleCalEvent[]>
  /** CalendarApp.createEvent(title, start, end, opts) -> { id }. */
  createEvent(title: string, start: Date, end: Date, opts?: { description?: string }): Promise<{ id: string }>
  /** Drive files list for the asRecentFiles_ query. */
  driveFiles(q: string): Promise<GoogleDriveFile[]>
}

const NOT_CONFIGURED =
  'Google is not connected: set GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY ' +
  'with domain-wide delegation to the assistant owner.'

let tokenCache: { token: string; expiresAt: number } | null = null

async function accessToken(subject: string): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.token
  const { google } = await import('googleapis')
  const client = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    clientOptions: { subject },
  })
  const auth = (await client.getClient()) as { getAccessToken(): Promise<{ token?: string | null }> }
  const res = await auth.getAccessToken()
  const token = String(res.token || '')
  if (!token) throw new Error('Google token mint failed.')
  tokenCache = { token, expiresAt: Date.now() + 3500e3 }
  return token
}

async function apiJson(subject: string, url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await accessToken(subject)
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, ...(init && init.headers ? (init.headers as Record<string, string>) : {}) },
  })
  const text = await r.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    data = {}
  }
  if (!r.ok) throw new Error('Google API ' + r.status + ': ' + text.slice(0, 200))
  return data
}

/**
 * The real adapter (service account, delegated as `subject`). Returns
 * { configured: false } when creds are absent — callers must branch on it.
 */
export function myDayGoogle(): MyDayGoogle | { configured: false } {
  const owner = process.env.GOOGLE_DELEGATED_USER || process.env.ASSISTANT_OWNER_EMAIL || ''
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !owner) {
    return { configured: false }
  }
  const subject = owner
  return {
    configured: true,
    async listThreads(q, maxResults) {
      const qs = '?q=' + encodeURIComponent(q) + '&maxResults=' + maxResults + '&fields=' + encodeURIComponent('threads(id)')
      const d = await apiJson(subject, 'https://gmail.googleapis.com/gmail/v1/users/me/threads' + qs)
      return (((d.threads as { id: string }[]) || []).map((t) => String(t.id)))
    },
    async getThreads(ids, headers) {
      const qs =
        '?format=metadata' +
        headers.map((h) => '&metadataHeaders=' + encodeURIComponent(h)).join('') +
        '&fields=' + encodeURIComponent('id,messages(internalDate,labelIds,payload/headers)')
      return Promise.all(
        ids.map(
          (id) =>
            apiJson(subject, 'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + encodeURIComponent(id) + qs) as Promise<GoogleThread>
        )
      )
    },
    async calendarEvents(start, end) {
      const qs =
        '?timeMin=' + encodeURIComponent(start.toISOString()) +
        '&timeMax=' + encodeURIComponent(end.toISOString()) +
        '&singleEvents=true&maxResults=250&fields=' +
        encodeURIComponent('items(id,summary,start,end,location,status,attendees,organizer,self,responseStatus)')
      const d = await apiJson(subject, 'https://www.googleapis.com/calendar/v3/calendars/primary/events' + qs)
      return (((d.items as Record<string, unknown>[]) || []).map((e) => {
        const s = e.start as Record<string, unknown> | undefined
        const en = e.end as Record<string, unknown> | undefined
        const allDay = !!(s && s.date)
        const startMs = Date.parse(String((s && (s.dateTime || s.date)) || '')) || 0
        const endMs = Date.parse(String((en && (en.dateTime || en.date)) || '')) || 0
        const attendees = (e.attendees as Record<string, unknown>[]) || []
        const self = attendees.filter((a) => a.self === true)[0]
        return {
          id: String(e.id || ''),
          title: String(e.summary || '(no title)'),
          start: startMs,
          end: endMs,
          allDay,
          location: String(e.location || ''),
          myStatus: String((self && self.responseStatus) || (e.organizer && (e.organizer as Record<string, unknown>).self ? 'OWNER' : '') || ''),
          guests: attendees.length,
        }
      }))
    },
    async createEvent(title, start, end, opts) {
      const d = await apiJson(subject, 'https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: title,
          description: opts && opts.description,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        }),
      })
      return { id: String(d.id || '') }
    },
    async driveFiles(q) {
      const url =
        'https://www.googleapis.com/drive/v3/files?pageSize=12&orderBy=' +
        encodeURIComponent('modifiedTime desc') +
        '&fields=' + encodeURIComponent('files(id,name,webViewLink,mimeType,modifiedTime)') +
        '&q=' + encodeURIComponent(q)
      const d = await apiJson(subject, url)
      return ((d.files as GoogleDriveFile[]) || [])
    },
  }
}

export const GOOGLE_NOT_CONFIGURED = NOT_CONFIGURED

/** Test seam: tests swap the adapter; production uses myDayGoogle(). */
let override: MyDayGoogle | { configured: false } | null = null

export function setMyDayGoogleForTests(g: MyDayGoogle | { configured: false } | null): void {
  override = g
}

export function google(): MyDayGoogle | { configured: false } {
  return override || myDayGoogle()
}
