/**
 * conflictTarget — every upsertOn key is emitted as a double-quoted
 * identifier so PostgREST never 42601s on reserved words (mail_log `to`),
 * while the engine's seen-map keeps raw column keys.
 */
import { describe, expect, it } from 'vitest'
import { conflictTarget } from '@/features/shared/migration/engine'

describe('conflictTarget', () => {
  it('quotes every key uniformly, including reserved words', () => {
    expect(conflictTarget('sent_at,to,subject')).toBe('"sent_at","to","subject"')
  })

  it('quotes a single key', () => {
    expect(conflictTarget('dedupe_key')).toBe('"dedupe_key"')
  })

  it('tolerates whitespace around commas', () => {
    expect(conflictTarget(' sent_at , to , subject ')).toBe('"sent_at","to","subject"')
  })
})
