import { describe, it, expect } from 'vitest'
import {
  sanitizeInput, newId, normHeader, isTrue, toClientValue, toCellValue,
  cacheGet, cachePut, cacheRemove, cacheClear, STAMP_FIELDS,
} from '@/lib/platform/repo'

describe('sanitizeInput / stamping (Repo.js)', () => {
  it('drops client-supplied stamps and internal keys', () => {
    const clean = sanitizeInput({
      name: 'A',
      submitted_by: 'evil@x.com',
      submitted_at: '2000-01-01',
      updated_by: 'evil@x.com',
      _secret: 'x',
    })
    expect(clean).toEqual({ name: 'A' })
    STAMP_FIELDS.forEach((f) => expect(clean[f]).toBeUndefined())
  })

  it('keeps ordinary fields untouched', () => {
    expect(sanitizeInput({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' })
    expect(sanitizeInput(null)).toEqual({})
  })
})

describe('formula-injection guard (toCellValue_)', () => {
  it('apostrophes =, +, @ and dash+non-digit', () => {
    expect(toCellValue('=1+1')).toBe("'=1+1")
    expect(toCellValue('+SUM(A1)')).toBe("'+SUM(A1)")
    expect(toCellValue('@cmd')).toBe("'@cmd")
    expect(toCellValue('-abc')).toBe("'-abc")
  })

  it('leaves negative numbers and ordinary text alone', () => {
    expect(toCellValue('-12')).toBe('-12')
    expect(toCellValue('-12.5')).toBe('-12.5')
    expect(toCellValue('hello')).toBe('hello')
  })

  it('serialises objects, keeps dates, empties null', () => {
    expect(toCellValue({ a: 1 })).toBe('{"a":1}')
    const d = new Date('2026-10-08T00:00:00Z')
    expect(toCellValue(d)).toBe(d)
    expect(toCellValue(null)).toBe('')
    expect(toCellValue(undefined)).toBe('')
  })
})

describe('small helpers', () => {
  it('normHeader collapses case and whitespace', () => {
    expect(normHeader('Promo  code ')).toBe('promo code')
    expect(normHeader('Promo Code')).toBe('promo code')
  })

  it('isTrue reads sheet-style booleans', () => {
    expect(isTrue(true)).toBe(true)
    expect(isTrue('TRUE')).toBe(true)
    expect(isTrue('false')).toBe(false)
    expect(isTrue('')).toBe(false)
  })

  it('toClientValue turns dates into ISO, invalid dates into empty', () => {
    expect(toClientValue(new Date('2026-10-08T00:00:00Z'))).toBe('2026-10-08T00:00:00.000Z')
    expect(toClientValue(new Date('junk'))).toBe('')
    expect(toClientValue('x')).toBe('x')
  })

  it('newId is prefixed and unique', () => {
    const a = newId('pop')
    const b = newId('pop')
    expect(a.startsWith('pop_')).toBe(true)
    expect(a).not.toBe(b)
    expect(newId().startsWith('id_')).toBe(true)
  })
})

describe('in-memory TTL cache (CacheService)', () => {
  it('round-trips, expires and removes', () => {
    cacheClear()
    cachePut('k', 'v', 60)
    expect(cacheGet('k')).toBe('v')
    cacheRemove('k')
    expect(cacheGet('k')).toBeNull()
    cachePut('gone', 'x', -1) // already expired
    expect(cacheGet('gone')).toBeNull()
  })
})
