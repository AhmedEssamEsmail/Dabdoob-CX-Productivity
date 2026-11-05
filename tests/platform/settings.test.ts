import { describe, it, expect } from 'vitest'
import {
  parseConfigValue, configKind, validateConfigValue, CONFIG_DEFAULTS, DQ_SETTINGS, ALL_SETTINGS,
} from '@/features/shared/platform/settings'
import { normEmail, pwIsManagerOf } from '@/features/shared/platform/identity'
import type { Directory } from '@/features/shared/platform/identity'

describe('parseConfigValue / configKind', () => {
  it('parses booleans, numbers and JSON; keeps the rest as text', () => {
    expect(parseConfigValue('true')).toBe(true)
    expect(parseConfigValue('false')).toBe(false)
    expect(parseConfigValue('42')).toBe(42)
    expect(parseConfigValue('-1.5')).toBe(-1.5)
    expect(parseConfigValue('["a","b"]')).toEqual(['a', 'b'])
    expect(parseConfigValue('{"k":1}')).toEqual({ k: 1 })
    expect(parseConfigValue('[broken')).toBe('[broken')
    expect(parseConfigValue('dabdoob.com')).toBe('dabdoob.com')
    expect(parseConfigValue('')).toBe('')
  })

  it('configKind by value type', () => {
    expect(configKind(true)).toBe('boolean')
    expect(configKind(4)).toBe('number')
    expect(configKind(['a'])).toBe('list')
    expect(configKind({ a: 1 })).toBe('json')
    expect(configKind('x')).toBe('text')
  })
})

describe('validateConfigValue (validateConfigValue_)', () => {
  it('coerces to the existing kind', () => {
    expect(validateConfigValue('mail_dry_run', 'false', true)).toBe(false)
    expect(validateConfigValue('prod_review_days', '9', 7)).toBe(9)
    expect(validateConfigValue('open_statuses', '["A","B"]', ['x'])).toEqual(['A', 'B'])
    expect(() => validateConfigValue('mail_dry_run', 'maybe', true)).toThrow('true or false')
    expect(() => validateConfigValue('prod_review_days', 'lots', 7)).toThrow('number')
    expect(() => validateConfigValue('open_statuses', 'not a list', ['x'])).toThrow('list')
  })

  it('enforces PROD_LIMITS whole-number bounds', () => {
    expect(() => validateConfigValue('prod_flag_cases_x', 0, 2)).toThrow('whole number')
    expect(() => validateConfigValue('prod_flag_cases_x', 2.5, 2)).toThrow('whole number')
    expect(validateConfigValue('prod_flag_cases_x', 5, 2)).toBe(5)
  })

  it('admin_emails: normalises, validates, keeps the actor', () => {
    expect(validateConfigValue('admin_emails', ' A@dabdoob.com ,b@dabdoob.com ', 'x@dabdoob.com', 'a@dabdoob.com')).toBe(
      'a@dabdoob.com,b@dabdoob.com'
    )
    expect(() => validateConfigValue('admin_emails', 'b@dabdoob.com', 'x@dabdoob.com', 'a@dabdoob.com')).toThrow('your own address')
    expect(() => validateConfigValue('admin_emails', 'not-an-email', 'x', 'a@dabdoob.com')).toThrow('email address')
    expect(() => validateConfigValue('admin_emails', '', 'x', 'a@dabdoob.com')).toThrow('at least one')
  })

  it('name-pattern checks: *_email, *_emails, *_tz, *_since', () => {
    expect(() => validateConfigValue('mail_reply_to', 'bad', '')).not.toThrow() // reply_to doesn't end in _email
    expect(() => validateConfigValue('assistant_owner_email', 'bad', '')).toThrow('email address')
    expect(validateConfigValue('assistant_owner_email', 'A@dabdoob.com', '')).toBe('A@dabdoob.com')
    expect(() => validateConfigValue('prod_activity_tz', 'Mars/Olympus', 'Asia/Kuwait')).toThrow('time zone')
    expect(validateConfigValue('prod_activity_tz', 'Asia/Kuwait', 'Asia/Kuwait')).toBe('Asia/Kuwait')
    expect(() => validateConfigValue('freshdesk_sync_since', '08/10/2026', '')).toThrow('yyyy-MM-dd')
  })
})

describe('seeded settings coverage', () => {
  it('CONFIG_DEFAULTS has the auth/mail/1:1 keys with mail dry-run on', () => {
    expect(CONFIG_DEFAULTS.allowed_domain.value).toBe('dabdoob.com')
    expect(CONFIG_DEFAULTS.mail_dry_run.value).toBe(true)
    expect(CONFIG_DEFAULTS.one_on_one_cutoff.value).toBe('22:00')
  })

  it('DQ_SETTINGS and PROD_SETTINGS are present in ALL_SETTINGS', () => {
    expect(Object.keys(DQ_SETTINGS).length).toBeGreaterThan(20)
    expect(ALL_SETTINGS.tph_channels).toBeDefined()
    expect(ALL_SETTINGS.days_off_default).toBeDefined()
    expect(ALL_SETTINGS.prod_flag_auto_accept.value).toBe(true)
    expect(ALL_SETTINGS.quarterly_report_recipients).toBeDefined()
  })
})

describe('identity pure helpers', () => {
  it('normEmail trims + lowercases', () => {
    expect(normEmail('  A.B@DABDOOB.COM ')).toBe('a.b@dabdoob.com')
    expect(normEmail(null)).toBe('')
  })

  it('pwIsManagerOf: admin manages all; TL manages direct reports', () => {
    const dir: Directory = {
      by: {},
      admins: ['boss@dabdoob.com'],
      person: () => null,
      name: (e) => e,
      managerOf: (e) => (e === 'ag@dabdoob.com' ? 'tl@dabdoob.com' : e === 'tl@dabdoob.com' ? 'boss@dabdoob.com' : null),
      agentsOf: () => [],
      tls: () => [],
    }
    expect(pwIsManagerOf({ role: 'admin', email: 'boss@dabdoob.com' }, 'ag@dabdoob.com', dir)).toBe(true)
    expect(pwIsManagerOf({ role: 'tl', email: 'tl@dabdoob.com' }, 'ag@dabdoob.com', dir)).toBe(true)
    expect(pwIsManagerOf({ role: 'tl', email: 'other@dabdoob.com' }, 'ag@dabdoob.com', dir)).toBe(false)
    expect(pwIsManagerOf({ role: 'agent', email: 'ag@dabdoob.com' }, 'ag@dabdoob.com', dir)).toBe(false)
  })
})
