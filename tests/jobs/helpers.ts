/**
 * In-memory JobEnv for job tests: every seam the jobs touch, write-through on
 * the table memo (the real env queues writes and flushes at step end — for a
 * synchronous assertion the memo is the truth either way).
 */
import { dqRosterPeople_, pwDirectory_, type Cfg, type HeadcountRow, type SheetBookLike } from '@/lib/prod/adapters'
import type { JobEnv, Row } from '@/lib/jobs/env'
import { sheetBook } from '@/lib/jobs/sheets'
import { tphBuildCallMinutes_, tphBuildCases_, tphBuildTouches_, tphClock_, tphHourMs_ } from '@/lib/tph'
import type { GmailReadAdapter } from '@/lib/platform/mail'
import { prodIntervalKey_, type ProdInterval } from '@/lib/prod/validation'

export interface StubEnvOpts {
  cfg?: Record<string, unknown>
  tables?: Record<string, Row[]>
  books?: Record<string, Record<string, unknown[][]>>
  activities?: unknown[][]
  rosterRows?: Row[]
  gmail?: GmailReadAdapter | null
  now?: number | Date
  flushError?: Error
}

export interface StubEnv extends JobEnv {
  tables: Record<string, Row[]>
  refreshLog: { job: string; status: string; info: Row }[]
  beats: { job: string; status: unknown; note?: unknown }[]
  sentMail: { to: string; subject: string; htmlBody?: string; status: string }[]
  sendMailStatus: string
}

export function stubEnv(opts: StubEnvOpts = {}): StubEnv {
  const cfg = ({
    ss_productivity_id: 'prod-store',
    business_tz: 'Asia/Kuwait',
    data_tz: 'Africa/Cairo',
    activity_local_tz: 'Asia/Kuwait',
    prod_activity_tz: 'Africa/Cairo',
    fd_activity_ss_id: 'fd-book',
    daily_report_ss_id: 'dr-book',
    productivity_fallback_id: 'month-book',
    admin_emails: 'admin@dabdoob.com',
    ...opts.cfg,
  } as unknown) as Cfg
  const tables = opts.tables || {}
  const books: Record<string, SheetBookLike> = {}
  Object.keys(opts.books || {}).forEach((id) => {
    books[id] = sheetBook(opts.books![id], id)
  })
  const activities = opts.activities || []
  const refreshLog: StubEnv['refreshLog'] = []
  const beats: StubEnv['beats'] = []
  const sentMail: StubEnv['sentMail'] = []
  const idSeq = { n: 0 }
  const rosterRows = (opts.rosterRows || []) as never
  const roster = dqRosterPeople_(rosterRows) as HeadcountRow[] | null

  const keyOf = (keys: string[]) => (r: Row) => keys.map((k) => String(r[k])).join('')
  const upsert = (table: string, cols: string[], rows: Row[]) => {
    const memo = (tables[table] = tables[table] || [])
    const key = keyOf(cols)
    rows.forEach((r) => {
      const i = memo.findIndex((x) => key(x) === key(r))
      if (i === -1) memo.push(r)
      else memo[i] = r
    })
  }

  const env = {
    cfg,
    dir: pwDirectory_(rosterRows, String(cfg.admin_emails || '')),
    headcount: (roster || []) as HeadcountRow[],
    roster,
    now: opts.now,
    today: opts.now,
    nowMs: opts.now === undefined ? undefined : new Date(opts.now).getTime(),

    prodRows: (name: string) => (tables[name] || []).map((r) => ({ ...r })),
    upsert: (t: string, cols: string[], rows: Row[]) => upsert(t, cols, rows),
    upsertIn: (t: string, cols: string[], rows: Row[]) => upsert(t, cols, rows),
    append: (t: string, rows: Row[]) => {
      tables[t] = (tables[t] || []).concat(rows)
    },
    replaceIntervals: (dates: string[], intervals: ProdInterval[]) => {
      const want: Record<string, boolean> = {}
      dates.forEach((d) => {
        want[d] = true
      })
      const kept = (tables.prod_intervals || []).filter((r) => !want[String(r.date)])
      const removed = (tables.prod_intervals || []).length - kept.length
      const rows = intervals.map((iv) => ({
        interval_key: prodIntervalKey_(iv),
        date: iv.date,
        agent_email: iv.agentEmail,
        agent_name: iv.agentName,
        status: iv.status,
        source_status: iv.sourceStatus,
        start_at: new Date(iv.startMs).toISOString(),
        end_at: new Date(iv.endMs).toISOString(),
        minutes: iv.minutes,
        source: iv.source,
        snapshot_at: new Date().toISOString(),
      }))
      tables.prod_intervals = kept.concat(rows)
      return { removed, added: rows.length }
    },
    flushWrites: async () => {
      if (opts.flushError) throw opts.flushError
    },

    openSpreadsheet: (id: string) => {
      const b = books[String(id)]
      if (!b) throw new Error('Spreadsheet ' + id + ' was not prefetched for this run.')
      return b
    },
    prefetchWorkbook: async () => {},
    prefetchMonthBooks: async () => {},
    activityRows: async () => activities,
    activityTail: (date: string, days: number) => {
      const from = tphHourMs_(date, 0, 'Asia/Kuwait') - days * 86400000
      const clock = tphClock_('Asia/Kuwait')
      return activities.filter((r) => {
        const t = clock.ms(r[0])
        return t !== null && t >= from
      })
    },
    ensureHeadcount: async () => {},

    cachedLive: (name: string) => (tables[name] || []).map((r) => ({ ...r })),
    readTickets: (_cols: string[], pick: (o: Row) => boolean) => {
      ;(tables['tickets'] || []).forEach((o) => {
        pick(o)
      })
    },
    readInflow: (year: number) => (tables['agg_inflow_hourly'] || []).filter((r) => Number(r.year) === year),
    prefetchTables: async () => {},
    ensureIntervals: async () => {},

    markDirty: (dates: string[]) => {
      const cur = Array.isArray(cfg.prod_dirty_dates) ? (cfg.prod_dirty_dates as string[]) : []
      const next = cur.slice()
      dates.forEach((d) => {
        if (d && next.indexOf(d) === -1) next.push(d)
      })
      next.sort()
      cfg.prod_dirty_dates = next
    },
    takeDirty: () => {
      const cur = Array.isArray(cfg.prod_dirty_dates) ? (cfg.prod_dirty_dates as string[]) : []
      cfg.prod_dirty_dates = cur.slice(31)
      return cur.slice(0, 31)
    },
    lastMail: () => {
      const v = cfg.prod_last_mail
      return v && typeof v === 'object' ? (v as { id?: string; ms?: number; importedAt?: string; dates?: string[] }) : {}
    },
    setLastMail: (v: { id: string; ms: number; importedAt: string; dates: string[] }) => {
      cfg.prod_last_mail = v
    },

    logRun: (job: string, _startedMs: number, status: string, info: Row) => {
      refreshLog.push({ job, status, info })
    },
    newId: (p: string) => p + '_t' + ++idSeq.n,
    log: () => {},

    buildTouches: (dates: string[], rows: unknown[][]) => tphBuildTouches_(dates, rows, env as never),
    buildCallMinutes: (dates: string[]) => tphBuildCallMinutes_(dates, env as never),
    buildCases: (dates: string[], rows: unknown[][] | null, part?: string) =>
      tphBuildCases_(dates, rows, part, env as never),

    gmail: opts.gmail === undefined ? null : opts.gmail,
    sendMail: async (msg: { to: string; subject: string; htmlBody?: string }) => {
      sentMail.push({ to: msg.to, subject: msg.subject, htmlBody: msg.htmlBody, status: env.sendMailStatus })
      return { status: env.sendMailStatus } as never
    },
    sendMailStatus: 'sent',
    hbBeat: (job: string, status: unknown, note?: unknown) => {
      beats.push({ job, status, note })
    },
    hbFlush: async () => beats.length,

    tables,
    refreshLog,
    beats,
    sentMail,
  } as unknown as StubEnv

  return env
}

/** A Gmail read-adapter stub that answers the one message it is given. */
export function stubGmail(mail: { id: string; internalDate: number; payload?: unknown } | null): GmailReadAdapter {
  return {
    listMessages: async () => (mail ? [{ id: mail.id }] : []),
    getMessage: async (id: string) => ({ id, internalDate: mail!.internalDate, payload: mail!.payload }),
    getAttachment: async () => ({ data: '' }),
  }
}

/** An 'Agents Activity' CSV: the PROD_SOURCE_COLS header + one row per entry. */
export function activityCsv(rows: [string, string, string, string][]): string {
  return ['Agent Name,Status Name,Start Time,End Time', ...rows.map((r) => r.join(','))].join('\n')
}

export function gmailPayloadWithCsv(csv: string): unknown {
  return { filename: 'agents-activity.csv', body: { data: Buffer.from(csv, 'utf8').toString('base64url') } }
}
