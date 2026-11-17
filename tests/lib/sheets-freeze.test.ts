import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertSheetReadAllowed_,
  SheetsFreezeError,
  SHEETS_FREEZE_QUALITY_ID,
  SHEETS_FREEZE_HCT_ID,
} from '@/features/shared/lib/sheets-freeze'

const ERR = vi.spyOn(console, 'error').mockImplementation(() => {})
afterEach(() => ERR.mockClear())

describe('assertSheetReadAllowed_', () => {
  it('allows the quality qa_audits read silently', () => {
    expect(() =>
      assertSheetReadAllowed_(SHEETS_FREEZE_QUALITY_ID, 'qa_audits')
    ).not.toThrow()
    expect(ERR).not.toHaveBeenCalled()
  })

  it('allows HCT Sheet1 only with manualHct, and only silently then', () => {
    expect(() =>
      assertSheetReadAllowed_(SHEETS_FREEZE_HCT_ID, 'Sheet1', { manualHct: true })
    ).not.toThrow()
    expect(() =>
      assertSheetReadAllowed_(SHEETS_FREEZE_HCT_ID, 'Sheet1')
    ).toThrowError(SheetsFreezeError)
    expect(ERR).not.toHaveBeenCalled()
  })

  it('allows Activities on an extraIds workbook id, nothing else on that id', () => {
    const id = 'extra-workbook-id'
    expect(() =>
      assertSheetReadAllowed_(id, 'Activities', { extraIds: [id] })
    ).not.toThrow()
    expect(() =>
      assertSheetReadAllowed_(id, 'Maqsam Calls', { extraIds: [id] })
    ).toThrowError(SheetsFreezeError)
  })

  it('deferred logs [SHEETS_FREEZE_VIOLATION] once and does not throw', () => {
    expect(() =>
      assertSheetReadAllowed_('some-id', 'Queue Log', { deferred: true })
    ).not.toThrow()
    expect(ERR).toHaveBeenCalledTimes(1)
    expect(ERR.mock.calls[0][0]).toContain('[SHEETS_FREEZE_VIOLATION]')
    expect(ERR.mock.calls[0][0]).toContain('some-id')
    expect(ERR.mock.calls[0][0]).toContain('Queue Log')
  })

  it('throws SheetsFreezeError naming id and tab for anything else', () => {
    try {
      assertSheetReadAllowed_('nonallow-id', 'prod-month-tab')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(SheetsFreezeError)
      expect((e as Error).message).toContain('nonallow-id')
      expect((e as Error).message).toContain('prod-month-tab')
    }
    expect(ERR).not.toHaveBeenCalled()
  })
})
