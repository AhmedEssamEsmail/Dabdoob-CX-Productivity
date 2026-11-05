import { describe, it, expect } from 'vitest'
import { groupOptions, isActiveOption, LIST_KEY_RE, OPTION_MAX_LEN, addOption } from '@/features/shared/platform/options'
import type { OptionRow } from '@/features/shared/platform/options'

describe('groupOptions (allOptions_ core)', () => {
  const rows: OptionRow[] = [
    { list_key: 'reasons', value: 'B', sort: 2, active: true },
    { list_key: 'reasons', value: 'a', sort: 1, active: true },
    { list_key: 'reasons', value: 'A', sort: 3, active: true }, // dedupe vs 'a': first spelling wins
    { list_key: 'reasons', value: 'Dead', sort: 0, active: false },
    { list_key: 'reasons', value: 'Unsorted', sort: null, active: true },
    { list_key: 'channels', value: 'Chat', sort: 1, active: true },
  ]

  it('filters inactive, sorts by sort (unsorted last), dedupes case-insensitively keeping first spelling', () => {
    const out = groupOptions(rows)
    // 'a' (sort 1) -> 'B' (2) -> 'A' (3) is dropped as a duplicate of 'a' -> 'Unsorted' (no sort) last.
    expect(out.reasons).toEqual(['a', 'B', 'Unsorted'])
    expect(out.channels).toEqual(['Chat'])
  })
})

// The duplicate 'A' vs 'a' case: first spelling kept, second dropped.
describe('groupOptions dedupe', () => {
  it('drops later case-insensitive duplicates', () => {
    const out = groupOptions([
      { list_key: 'k', value: 'Apple', sort: 1, active: true },
      { list_key: 'k', value: 'APPLE', sort: 2, active: true },
      { list_key: 'k', value: 'banana', sort: null, active: true },
    ])
    expect(out.k).toEqual(['Apple', 'banana'])
  })

  it('isActiveOption', () => {
    expect(isActiveOption({ active: true })).toBe(true)
    expect(isActiveOption({ active: 'TRUE' })).toBe(true)
    expect(isActiveOption({ active: false })).toBe(false)
    expect(isActiveOption({ active: 'false' })).toBe(false)
  })
})

describe('addOption validation (before any storage call)', () => {
  it('rejects a bad list key', async () => {
    await expect(addOption('Bad Key!', 'x', 'a@dabdoob.com')).rejects.toThrow('Unknown dropdown.')
    expect(LIST_KEY_RE.test('good_key-1.x')).toBe(true)
    expect(LIST_KEY_RE.test('Bad Key!')).toBe(false)
  })

  it('rejects empty, over-long and "other" values', async () => {
    await expect(addOption('reasons', '   ', 'a@dabdoob.com')).rejects.toThrow('Type a value')
    await expect(addOption('reasons', 'x'.repeat(OPTION_MAX_LEN + 1), 'a@dabdoob.com')).rejects.toThrow('120')
    await expect(addOption('reasons', 'OTHER', 'a@dabdoob.com')).rejects.toThrow('Other')
  })
})
