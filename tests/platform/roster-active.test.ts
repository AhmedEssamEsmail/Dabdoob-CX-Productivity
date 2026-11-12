import { describe, expect, it } from 'vitest'
import { pwDirectory_ } from '@/features/shared/lib/adapters'

describe('roster active NULL -> active', () => {
  it('treats NULL active as active in pwDirectory_', () => {
    const dir = pwDirectory_(
      [{ email: 'a@dabdoob.com', name: 'A', role: 'agent', tl_email: null, active: null }],
      ''
    )
    expect(dir.by['a@dabdoob.com'].active).toBe(true)
  })

  it('still treats "false" active as inactive', () => {
    const dir = pwDirectory_(
      [{ email: 'b@dabdoob.com', name: 'B', role: 'agent', tl_email: null, active: 'false' }],
      ''
    )
    expect(dir.by['b@dabdoob.com'].active).toBe(false)
  })

  it('treats boolean true/false correctly', () => {
    const dir = pwDirectory_(
      [
        { email: 'c@dabdoob.com', name: 'C', role: 'agent', tl_email: null, active: true },
        { email: 'd@dabdoob.com', name: 'D', role: 'agent', tl_email: null, active: false },
      ],
      ''
    )
    expect(dir.by['c@dabdoob.com'].active).toBe(true)
    expect(dir.by['d@dabdoob.com'].active).toBe(false)
  })
})
