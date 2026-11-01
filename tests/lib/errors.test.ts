/**
 * describeDbError coverage — every mapping row in spec 02: PostgREST/PG
 * missing-store, Google credentials, 403/404/429 sheets, missing tab, missing
 * config, write conflicts, fallback — plus the apiError envelope.
 */
import { describe, expect, it } from 'vitest'
import { describeDbError, described, DescribedError } from '@/lib/errors'
import { apiError, dbErr, InputError } from '@/lib/api-error'

const PGRST205 = "Could not find the table 'public.fd_activities' in the schema cache"

describe('describeDbError', () => {
  it('PGRST205 message -> missing_store with the mirror-sync hint', () => {
    const d = describeDbError({ message: PGRST205, code: 'PGRST205' }, { table: 'fd_activities' })
    expect(d.code).toBe('missing_store')
    expect(d.message).toContain("'fd_activities'")
    expect(d.hint).toContain('/api/admin/mirrors')
  })

  it('PG 42P01 -> missing_store, table pulled from the message', () => {
    const d = describeDbError({ message: 'relation "public.maqsam_calls" does not exist', code: '42P01' })
    expect(d.code).toBe('missing_store')
    expect(d.message).toContain("'maqsam_calls'")
  })

  it('schema-cache wording without a code still maps via ctx.table', () => {
    const d = describeDbError({ message: 'freshchat missing from schema cache' }, { table: 'freshchat' })
    expect(d.code).toBe('missing_store')
  })

  it('google credential errors -> missing_credentials', () => {
    const d = describeDbError(new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured'))
    expect(d.code).toBe('missing_credentials')
    expect(d.hint).toContain('GOOGLE_PRIVATE_KEY')
  })

  it('sheet 403 -> source_forbidden with the share hint', () => {
    const d = describeDbError({ status: 403, message: 'The caller does not have permission' }, { workbook: 'w1', tab: 'Activities' })
    expect(d.code).toBe('source_forbidden')
    expect(d.hint).toContain('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    expect(d.message).toContain('w1')
  })

  it('sheet 404 -> source_unreachable', () => {
    const d = describeDbError({ status: 404, message: 'Requested entity was not found.' }, { workbook: 'w1' })
    expect(d.code).toBe('source_unreachable')
  })

  it('429/quota -> rate_limited', () => {
    const d = describeDbError({ status: 429, message: 'Quota exceeded' }, { workbook: 'w1' })
    expect(d.code).toBe('rate_limited')
    expect(d.hint).toContain('retry')
  })

  it('unparseable range -> missing_source naming the tab', () => {
    const d = describeDbError({ status: 400, message: "Unable to parse range: 'Freshchat'" }, { tab: 'Freshchat' })
    expect(d.code).toBe('missing_source')
    expect(d.message).toContain('Freshchat')
  })

  it('missing/blank config -> missing_config naming the key', () => {
    const d = describeDbError(new Error('fd_activity_ss_id is not configured'), { configKey: 'fd_activity_ss_id' })
    expect(d.code).toBe('missing_config')
    expect(d.message).toContain('fd_activity_ss_id')
  })

  it('unprefetched workbook -> missing_source', () => {
    const d = describeDbError(new Error('Spreadsheet abc was not prefetched for this run.'))
    expect(d.code).toBe('missing_source')
    expect(d.hint).toContain('prefetchWorkbook')
  })

  it('unique violation -> write_conflict', () => {
    const d = describeDbError({ message: 'duplicate key value violates unique constraint "prod_flags_pkey"', code: '23505' }, { table: 'prod_flags' })
    expect(d.code).toBe('write_conflict')
    expect(d.message).toContain('prod_flags')
  })

  it('anything else -> internal with the raw message', () => {
    const d = describeDbError(new Error('something odd'))
    expect(d.code).toBe('internal')
    expect(d.message).toBe('something odd')
  })

  it('a DescribedError passes through unchanged', () => {
    const orig = described({ message: PGRST205 }, { table: 'fd_activities' })
    const d = describeDbError(orig)
    expect(d.code).toBe('missing_store')
    expect(d.hint).toContain('/api/admin/mirrors')
  })

  it('step context prefixes the message', () => {
    const d = describeDbError({ message: PGRST205 }, { table: 'fd_activities', step: 'touches 2026-10-01' })
    expect(d.message.startsWith('touches 2026-10-01')).toBe(true)
  })
})

describe('apiError envelope', () => {
  it('DescribedError -> {error, code, detail, hint} at 503', async () => {
    const res = apiError(described({ message: PGRST205, code: 'PGRST205' }, { table: 'fd_activities' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('missing_store')
    expect(body.error).toContain('fd_activities')
    expect(body.hint).toBeTruthy()
  })

  it('internal DescribedError -> 500', async () => {
    const res = apiError(new DescribedError({ code: 'internal', message: 'x' }))
    expect(res.status).toBe(500)
  })

  it('InputError -> its status; Unauthorized -> 401', async () => {
    expect((await apiError(new InputError('bad payload', 400))).status).toBe(400)
    expect((await apiError(new Error('Unauthorized'))).status).toBe(401)
  })

  it('dbErr maps a raw PostgREST error into the envelope', async () => {
    const res = dbErr('freshchat', { message: PGRST205.replace('fd_activities', 'freshchat'), code: 'PGRST205' })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('missing_store')
    expect(body.error).toContain('freshchat')
  })
})
