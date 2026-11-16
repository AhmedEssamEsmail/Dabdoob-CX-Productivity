import { describe, expect, it } from 'vitest'
import { dqHctActive_ } from '@/features/cx-hub/lib/roster'

describe('dqHctActive_', () => {
  it('active when status current and lwd blank', () => {
    expect(dqHctActive_({ status: 'Current', lwd: '' })).toBe(true)
  })

  it('active when lwd is dash', () => {
    expect(dqHctActive_({ status: 'Current', lwd: '-' })).toBe(true)
  })

  it('inactive when lwd is a date string', () => {
    expect(dqHctActive_({ status: 'Current', lwd: '2025-12-31' })).toBe(false)
  })

  it('inactive when status is not current', () => {
    expect(dqHctActive_({ status: 'Terminated', lwd: '' })).toBe(false)
  })

  it('trims and lowercases status; whitespace lwd ok', () => {
    expect(dqHctActive_({ status: ' current ', lwd: ' ' })).toBe(true)
  })

  it('inactive when lwd is a Date', () => {
    expect(dqHctActive_({ status: 'Current', lwd: new Date('2025-01-01') })).toBe(false)
  })
})
