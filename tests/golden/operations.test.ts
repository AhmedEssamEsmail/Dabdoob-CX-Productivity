/**
 * Golden: Operations — the trackers module (Operations_deprecated/Trackers.js)
 * against src/features/cx-operations/lib/trackers.ts, same fixtures on both
 * sides (ops-fakes): the legacy file runs verbatim in the oracle; the port runs
 * against hub-fakes + a fake sheet io (the D-GOOGLE seam).
 *
 * Every expectSame is a byte-parity check of the { ok } / { err } envelope;
 * comments name the legacy function under test (Trackers.js: <fn>).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import {
  matchChoice_,
  parseTrackerNumber_,
  validTrackerUrl_,
  validDateText_,
  slugId_,
  trackerValueHash_,
  trackerListKey_,
  trackerDepKey_,
  rolesList_,
  trackerIsReadOnly_,
  cleanChoiceList_,
  uniqueFieldId_,
  mapTrackerColumns_,
  trackerCellOut_,
  trackerPerms_,
  trackerSummary_,
  trackerRegistry_,
  readTrackerData_,
  validateTrackerRecord_,
  refuseTrackerWrite_,
  normaliseFieldDef_,
  getTrackersPage,
  getTrackerRecords,
  addTrackerRecord,
  addTrackerField,
  updateTrackerField,
  createTracker,
  setupTrackers,
  REFUND_LEDGER_SPREADSHEET_ID,
  TRACKER_MAX_ROWS,
  type Tracker,
  type TrackerField,
} from '@/features/cx-operations/lib/trackers'
import { allOptions } from '@/features/shared/platform/options'
import type { PlatformUser } from '@/features/shared/platform/identity'
import { hubDb } from './hub-fakes'
import { opsInstall, opsCall, opsSame, opsTable, opsSheetCells, opsOptions, portCall, expectSame, type OpsFx } from './ops-fakes'
import { json } from './helpers-oracle'

const NOW = Date.parse('2026-10-08T09:00:00Z') // 2026-10-08 12:00 Kuwait
const H = 3600000
const ISO = (ms: number) => new Date(ms).toISOString()
/** Sparse oracle rows: a cell past the written run reads as '' (getDataRange pads to lastColumn). */
const cellStr = (row: unknown[] | undefined, i: number) => (row && i < row.length ? String(row[i]) : '')

const ROSTER = [
  { email: 'admin@dabdoob.com', name: 'Admin Person', role: 'admin', tl_email: '', active: true },
  { email: 'tl@dabdoob.com', name: 'Tessa Lead', role: 'tl', tl_email: '', active: true },
  { email: 'agent@dabdoob.com', name: 'Andy Agent', role: 'agent', tl_email: 'tl@dabdoob.com', active: true },
  { email: 'agent2@dabdoob.com', name: 'Beth Agent', role: 'agent', tl_email: 'tl@dabdoob.com', active: true },
]
const SETTINGS = { allowed_domain: 'dabdoob.com', admin_emails: 'admin@dabdoob.com' }

function fx(over: OpsFx = {}): OpsFx {
  const { tables, settings, ...rest } = over
  return {
    userEmail: 'admin@dabdoob.com',
    nowMs: NOW,
    scriptTz: 'Asia/Kuwait', // trackerCellOut_ formats sheet Dates in the sheet tz; the port pins +3
    settings: { ...SETTINGS, ...(settings || {}) },
    tables: { roster: ROSTER.map((r) => ({ ...r })), ...(tables || {}) },
    ...rest,
  }
}

// ---------------------------------------------------------------- registry builders

/** One Trackers registry row (Postgres trackers-table shape). */
function trkRow(t: Partial<Tracker> & { id: string }): Record<string, unknown> {
  return {
    tracker_id: t.id,
    name: t.name || t.id,
    storage_mode: t.storage || 'external',
    spreadsheet_id: t.spreadsheetId || 'ss-' + t.id,
    tab_name: t.tab || 'Sheet1',
    header_row: t.headerRow ?? 1,
    access_mode: t.accessMode || 'edit',
    form_backed: t.formBacked ? 'TRUE' : '',
    record_id_header: t.recordIdHeader || 'record_id',
    record_id_format: t.recordIdFormat || '',
    submitted_by_header: t.submittedByHeader || 'submitted_by',
    submitted_at_header: t.submittedAtHeader || 'submitted_at',
    viewer_roles: (t.viewerRoles || ['admin', 'tl']).join(','),
    editor_roles: (t.editorRoles || ['admin', 'tl']).join(','),
    builder_roles: (t.builderRoles || ['admin']).join(','),
    owner_email: t.ownerEmail || '',
    archived_at: t.archived ? '2026-01-01T00:00:00.000Z' : '',
    submitted_by: 'seed',
    submitted_at: '2026-01-01T00:00:00.000Z',
  }
}

/** One TrackerFields registry row (Postgres tracker_fields shape). */
function fldRow(t: Tracker, f: Partial<TrackerField> & { id: string; position: number; active?: boolean }): Record<string, unknown> {
  return {
    field_id: f.id,
    tracker_id: t.id,
    position: f.position,
    label: f.label || f.id,
    column_header: f.header || f.label || f.id,
    type: f.type || 'text',
    required: f.required ? 'TRUE' : '',
    list_key: f.listKey || '',
    parent_field_id: f.parentFieldId || '',
    auto: f.auto || '',
    active: f.active === false ? 'FALSE' : 'TRUE',
    submitted_by: 'seed',
    submitted_at: '2026-01-01T00:00:00.000Z',
  }
}

/** The promocodes-shaped external tracker used across the record tests. */
function promoTracker(): Tracker {
  return {
    id: 'promocodes',
    name: 'Promocodes',
    storage: 'external',
    spreadsheetId: 'promo-ss',
    tab: 'Form Responses 1',
    headerRow: 1,
    accessMode: 'edit',
    formBacked: true,
    recordIdHeader: 'record_id',
    recordIdFormat: 'OL{n}',
    submittedByHeader: 'Email Address',
    submittedAtHeader: 'Timestamp',
    viewerRoles: ['admin', 'tl', 'agent'],
    editorRoles: ['admin', 'tl', 'agent'],
    builderRoles: ['admin'],
    ownerEmail: '',
    archived: false,
    fields: [
      { id: 'promo_code', label: 'Promo Code', header: 'Promo Code', type: 'text', required: true, listKey: '', parentFieldId: '', auto: '', position: 1 },
      { id: 'kind', label: 'Percentage or Fixed Value?', header: 'Percentage or Fixed Value?', type: 'dropdown', required: true, listKey: 'tracker.promocodes.kind', parentFieldId: '', auto: '', position: 2 },
      { id: 'value', label: 'Value (Fixed or Percentage)', header: 'Value (Fixed or Percentage)', type: 'number', required: true, listKey: '', parentFieldId: '', auto: '', position: 3 },
      { id: 'cap_kd', label: 'Cap', header: 'Cap', type: 'money', required: false, listKey: '', parentFieldId: '', auto: '', position: 4 },
      { id: 'link', label: 'Terms Link', header: 'Terms Link', type: 'link', required: false, listKey: '', parentFieldId: '', auto: '', position: 5 },
      { id: 'start', label: 'Start Date', header: 'Start Date', type: 'date', required: false, listKey: '', parentFieldId: '', auto: '', position: 6 },
      { id: 'region', label: 'Region', header: 'Region', type: 'dropdown', required: false, listKey: 'tracker.promocodes.region', parentFieldId: '', auto: '', position: 7 },
      { id: 'city', label: 'City', header: 'City', type: 'dependent', required: false, listKey: 'tracker.promocodes.city', parentFieldId: 'region', auto: '', position: 8 },
      { id: 'total', label: 'Total (computed)', header: 'Total (computed)', type: 'computed', required: false, listKey: '', parentFieldId: '', auto: '', position: 9 },
      { id: 'created_by', label: 'Created By', header: 'Created By', type: 'text', required: false, listKey: '', parentFieldId: '', auto: 'actor_name', position: 10 },
    ],
  }
}

/** Registry tables + the Options rows the tracker's dropdowns use. */
function promoFx(over: OpsFx = {}): OpsFx {
  const t = promoTracker()
  return fx({
    tables: {
      trackers: [trkRow(t)],
      tracker_fields: t.fields.map((f) => fldRow(t, f)),
      options: [
        { list_key: 'tracker.promocodes.kind', value: 'Percentage', sort: '', active: true },
        { list_key: 'tracker.promocodes.kind', value: 'Fixed', sort: '', active: true },
        { list_key: 'tracker.promocodes.region', value: 'Kuwait', sort: '', active: true },
        { list_key: 'tracker.promocodes.region', value: 'KSA', sort: '', active: true },
        { list_key: 'tracker.promocodes.city.' + trackerDepKey_('promocodes', 'city', 'Kuwait').split('.').pop(), value: 'Kuwait City', sort: '', active: true },
        { list_key: 'tracker.promocodes.city.' + trackerDepKey_('promocodes', 'city', 'KSA').split('.').pop(), value: 'Riyadh', sort: '', active: true },
      ],
      ...(over.tables || {}),
    },
    ...over,
  })
}

/** The external sheet behind promocodes (headers by TEXT; sys columns appended by V2). */
function promoSheet(extraDataRows: unknown[][] = []): Record<string, Record<string, unknown[][]>> {
  return {
    'promo-ss': {
      'Form Responses 1': [
        ['Promo Code', 'Percentage or Fixed Value?', 'Value (Fixed or Percentage)', 'Cap', 'Terms Link', 'Start Date', 'Region', 'City', 'Created By', 'record_id', 'Email Address', 'Timestamp'],
        ['SALE10', 'Percentage', '10', '50', 'https://x.y/terms', '2026-10-01', 'Kuwait', 'Kuwait City', 'Andy Agent', 'OL4', 'agent@dabdoob.com', '@@ms:' + (NOW - 86400000)],
        ['', '', '', '', '', '', '', '', '', '', '', ''], // a fully blank row is skipped
        ...extraDataRows,
      ],
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

// =====================================================================
// Pure helpers
// =====================================================================

describe('matchChoice_ (Trackers.js: matchChoice_)', () => {
  const vectors: [unknown[], unknown][] = [
    [['Percentage', 'Fixed'], 'percentage'],
    [['Percentage', 'Fixed'], 'FIXED'],
    [['Percentage', 'Fixed'], 'other'],
    [[], 'x'],
    [['a'], 'a '], // trailing space: no match (the value is not trimmed here)
    [['Other'], 'other'],
    [['Other'], 'OTHER'],
  ]
  for (const [list, value] of vectors) {
    it(`${JSON.stringify(value)} in ${JSON.stringify(list)}`, async () => {
      const { port } = await opsSame('matchChoice_', [list, value], fx(), () => matchChoice_(list, value))
      expect(port.ok === null || typeof port.ok === 'string').toBe(true)
    })
  }
  it('non-string lists: the port returns the canonical SPELLING (String(x)), legacy the raw element', async () => {
    // Options values are always strings in practice; the port's `String(list[i])`
    // normalises the hit where legacy returns the element verbatim.
    const { fixture } = opsInstall(fx())
    const legacyRes = opsCall('matchChoice_', [[1, 2], '2'], fixture)
    const portRes = await portCall(() => matchChoice_([1, 2], '2'))
    expect(legacyRes.ok).toBe(2)
    expect(portRes.ok).toBe('2')
  })
})

describe('parseTrackerNumber_ (Trackers.js: parseTrackerNumber_)', () => {
  const vectors: unknown[] = [
    '1234.5',
    ' 1,234.500 ',
    '1,234,567.5',
    '-12',
    '12,5',
    '12 KD',
    '',
    '  ',
    '1.2.3',
    '1,23',
    '12,345',
    '007',
    '-1,234.75',
    42,
    -7.25,
    0,
    NaN,
    Infinity,
    null,
    undefined,
    '1,234,567', // grouped thousands with no decimals
    '1234567', // plain digits
    '1,2345', // wrong grouping stays a parse failure
  ]
  for (const v of vectors) {
    it(JSON.stringify(v), async () => {
      await opsSame('parseTrackerNumber_', [v], fx(), () => parseTrackerNumber_(v))
    })
  }
})

describe('validTrackerUrl_ (Trackers.js: validTrackerUrl_)', () => {
  const vectors: unknown[] = [
    'https://x.y',
    'http://a.b/c?d=e#f',
    'HTTPS://UP.CASE/path',
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://x.y',
    'x.y',
    '//x.y',
    'https://',
    'https://x y',
    'https:// x.y',
    ' http://a.b ', // surrounding space fails
    '',
    null,
    'https://x.y/with space',
  ]
  for (const v of vectors) {
    it(JSON.stringify(v), async () => {
      await opsSame('validTrackerUrl_', [v], fx(), () => validTrackerUrl_(v))
    })
  }
})

describe('validDateText_ (Trackers.js: validDateText_)', () => {
  const vectors = ['2026-10-08', '2026-02-29', '2024-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '2026-10-00', '2026-1-8', '26-10-08', '2026/10/08', '2026-10-8x', '', ' 2026-10-08', '2026-10-08 ']
  for (const v of vectors) {
    it(JSON.stringify(v), async () => {
      await opsSame('validDateText_', [v], fx(), () => validDateText_(v))
    })
  }
})

describe('slugId_ (Trackers.js: slugId_)', () => {
  const vectors: [unknown, number?][] = [
    ['Promo Code'],
    ['  Weird  Name!! '],
    ['', 10],
    ['a', 16],
    ['very very long label goes beyond the cap', 10],
    ['___'],
    ['Promo%20Code', 8],
    ['مسمى عربي'],
  ]
  for (const [s, max] of vectors) {
    it(`${JSON.stringify(s)} max=${max}`, async () => {
      await opsSame('slugId_', [s, max], fx(), () => slugId_(s, max))
    })
  }
})

describe('trackerValueHash_ / trackerListKey_ / trackerDepKey_ (Trackers.js)', () => {
  const values = ['Kuwait', '  KUWAIT ', 'ku  wait', 'Other', '', 'SALE10']
  for (const v of values) {
    it(`hash ${JSON.stringify(v)}`, async () => {
      await opsSame('trackerValueHash_', [v], fx(), () => trackerValueHash_(v))
    })
  }
  it('listKey + depKey', async () => {
    await opsSame('trackerListKey_', ['promocodes', 'kind'], fx(), () => trackerListKey_('promocodes', 'kind'))
    await opsSame('trackerDepKey_', ['promocodes', 'city', ' Kuwait '], fx(), () => trackerDepKey_('promocodes', 'city', ' Kuwait '))
  })
})

describe('rolesList_ / trackerIsReadOnly_ / cleanChoiceList_ / uniqueFieldId_ (Trackers.js)', () => {
  it('rolesList_ vectors', async () => {
    for (const v of ['admin,tl', ' admin , tl ,agent ', '', 'admin', ' , ', 'admin,admin']) {
      await opsSame('rolesList_', [v], fx(), () => rolesList_(v))
    }
  })
  it('trackerIsReadOnly_ vectors', async () => {
    const cases: Pick<Tracker, 'accessMode' | 'spreadsheetId'>[] = [
      { accessMode: 'edit', spreadsheetId: 'any' },
      { accessMode: 'view_only', spreadsheetId: 'any' },
      { accessMode: 'edit', spreadsheetId: REFUND_LEDGER_SPREADSHEET_ID }, // read-only by sheet id, whatever the flag says
      { accessMode: '', spreadsheetId: '' },
    ]
    for (const t of cases) {
      await opsSame('trackerIsReadOnly_', [t], fx(), () => trackerIsReadOnly_(t))
    }
  })
  it('cleanChoiceList_ vectors', async () => {
    for (const v of [
      ['A', 'a', 'B'],
      ['other', 'OTHER', 'Keep'],
      ['  spaced   out ', 'ok'],
      [],
      ['x'.repeat(121)],
      ['ok', '', '  '],
    ]) {
      await opsSame('cleanChoiceList_', [v], fx(), () => cleanChoiceList_(v))
    }
    // Non-array input: legacy throws a TypeError on (list||[]).forEach; the port's
    // Array.isArray guard returns []. Both end up refusing the write downstream,
    // only the error text differs — a documented port-hardening seam.
    const { fixture } = opsInstall(fx())
    const legacyRes = opsCall('cleanChoiceList_', ['not-an-array'], fixture)
    const portRes = await portCall(() => cleanChoiceList_('not-an-array'))
    expect(legacyRes.err).toMatch(/forEach/)
    expect(portRes.ok).toEqual([])
  })
  it('uniqueFieldId_ vectors', async () => {
    const t = { fields: [{ id: 'promo_code' }, { id: 'x' }] as TrackerField[] }
    for (const [label, taken] of [
      ['Promo Code', undefined],
      ['Promo Code', ['promo_code_2']],
      ['New One', ['new_one', 'new_one_2']],
      ['!!!', []],
    ] as [string, string[] | undefined][]) {
      await opsSame('uniqueFieldId_', [t, label, taken], fx(), () => uniqueFieldId_(t, label, taken))
    }
  })
})

describe('mapTrackerColumns_ / trackerCellOut_ (Trackers.js)', () => {
  const t = promoTracker()
  it('maps by header text, fails closed on a missing column', async () => {
    const headers = ['Promo Code', 'Percentage or Fixed Value?', 'Value (Fixed or Percentage)', 'Total (computed)', 'Cap', 'Terms Link', 'Start Date', 'Region', 'City', 'Created By', 'record_id', 'Email Address', 'Timestamp']
    await opsSame('mapTrackerColumns_', [t, headers], fx(), () => mapTrackerColumns_(t, headers))
    const reordered = [...headers.slice(5), ...headers.slice(0, 5)]
    await opsSame('mapTrackerColumns_', [t, reordered], fx(), () => mapTrackerColumns_(t, reordered))
    const missing = headers.filter((h) => h !== 'City')
    await opsSame('mapTrackerColumns_', [t, missing], fx(), () => mapTrackerColumns_(t, missing))
    const dup = headers.concat(['Promo Code']) // a second column with the same header never steals the first
    await opsSame('mapTrackerColumns_', [t, dup], fx(), () => mapTrackerColumns_(t, dup))
  })
  it('trackerCellOut_ formats Dates in the sheet tz (Asia/Kuwait here)', async () => {
    // Legacy signature (v, tz); the port pins Asia/Kuwait (+3, the sheet tz the app writes for).
    for (const ms of [0, NOW, NOW - 3600000, Date.UTC(2026, 0, 1, 0, 0, 0)]) {
      await opsSame('trackerCellOut_', ['@@ms:' + ms, 'Asia/Kuwait'], fx(), () => trackerCellOut_(new Date(ms)))
    }
    await opsSame('trackerCellOut_', ['', 'Asia/Kuwait'], fx(), () => trackerCellOut_(''))
    await opsSame('trackerCellOut_', [null, 'Asia/Kuwait'], fx(), () => trackerCellOut_(null))
    await opsSame('trackerCellOut_', ['text', 'Asia/Kuwait'], fx(), () => trackerCellOut_('text'))
  })
})

describe('trackerPerms_ / trackerSummary_ (Trackers.js)', () => {
  const t = promoTracker()
  const ro = { ...t, accessMode: 'view_only' }
  const users = [
    { role: 'admin', email: 'admin@dabdoob.com', name: 'Admin Person' },
    { role: 'tl', email: 'tl@dabdoob.com', name: 'Tessa Lead' },
    { role: 'agent', email: 'agent@dabdoob.com', name: 'Andy Agent' },
    { role: 'unknown', email: 'nobody@dabdoob.com', name: 'Nobody' },
  ]
  for (const u of users) {
    it(`perms for ${u.role}`, async () => {
      await opsSame('trackerPerms_', [t, u], fx(), () => trackerPerms_(t, u))
      await opsSame('trackerPerms_', [ro, u], fx(), () => trackerPerms_(ro, u))
      await opsSame('trackerSummary_', [t, u], fx(), () => trackerSummary_(t, u))
      await opsSame('trackerSummary_', [ro, u], fx(), () => trackerSummary_(ro, u))
    })
  }
})

describe('refuseTrackerWrite_ (Trackers.js: refuseTrackerWrite_)', () => {
  const t = promoTracker()
  it('refuses view-only and the refund ledger', async () => {
    await opsSame('refuseTrackerWrite_', [t], fx(), () => refuseTrackerWrite_(t))
    await opsSame('refuseTrackerWrite_', [{ ...t, accessMode: 'view_only' }], fx(), () => refuseTrackerWrite_({ ...t, accessMode: 'view_only' }))
    // Built-in: the ledger is refused by spreadsheet id even when the flag says edit.
    const ledger = { ...t, id: 'refund_ledger', name: 'Refund calculator backend', accessMode: 'edit', spreadsheetId: REFUND_LEDGER_SPREADSHEET_ID }
    await opsSame('refuseTrackerWrite_', [ledger], fx(), () => refuseTrackerWrite_(ledger))
  })
})

// =====================================================================
// Record validation (the coercion table)
// =====================================================================

describe('validateTrackerRecord_ (Trackers.js: validateTrackerRecord_)', () => {
  const t = promoTracker()
  const valid = {
    promo_code: '  SALE20  ',
    kind: 'percentage', // case-insensitive canonicalisation back to 'Percentage'
    value: ' 1,234.500 ',
    cap_kd: '25.5',
    link: 'https://terms.example/x',
    start: '2026-11-01',
    region: 'KUWAIT', // canonicalised to 'Kuwait'
    city: 'kuwait city', // dependent: canonicalised inside the parent answer's list
  }
  it('a full valid record is cleaned identically', async () => {
    await opsSame('validateTrackerRecord_', [t, valid], promoFx(), async () => validateTrackerRecord_(t, valid, await allOptions()))
  })
  it('a record that omits optional fields cleans identically', async () => {
    const input = { promo_code: 'SALE', kind: 'Fixed', value: '5' }
    await opsSame('validateTrackerRecord_', [t, input], promoFx(), async () => validateTrackerRecord_(t, input, await allOptions()))
  })
  const errors: [string, Record<string, unknown>][] = [
    ['missing required text', { ...valid, promo_code: '' }],
    ['missing required dropdown', { ...valid, kind: '' }],
    ['unknown field id', { ...valid, bogus: 'x' }],
    ['bad date', { ...valid, start: '01/11/2026' }],
    ['date not a real day', { ...valid, start: '2026-02-30' }],
    ['bad number', { ...valid, value: '12 KD' }],
    ['bad money grouping', { ...valid, cap_kd: '1,23.4' }],
    ['money too many decimals', { ...valid, cap_kd: '1.2345' }],
    ['money three decimals ok boundary', { ...valid, cap_kd: '1.234' }],
    ['javascript link', { ...valid, link: 'javascript:alert(1)' }],
    ['bare domain link', { ...valid, link: 'example.com/x' }],
    ['not a dropdown choice', { ...valid, kind: 'weekly' }],
    ['not a dependent choice for that parent', { ...valid, city: 'Riyadh' }],
    ['dependent without the parent answered', { ...valid, region: '', city: 'Kuwait City' }],
    ['dependent on a missing parent field', { ...valid, city: 'Kuwait City' }], // covered below with a tweaked tracker
    ['value over 2000 chars', { ...valid, promo_code: 'x'.repeat(2001) }],
    ['value exactly 2000 chars', { ...valid, promo_code: 'x'.repeat(2000) }],
  ]
  for (const [label, input] of errors) {
    it(label, async () => {
      await opsSame('validateTrackerRecord_', [t, input], promoFx(), async () => validateTrackerRecord_(t, input, await allOptions()))
    })
  }
  it('a dependent whose parent field is gone errors identically', async () => {
    const orphan: Tracker = { ...t, fields: t.fields.filter((f) => f.id !== 'region') }
    await opsSame('validateTrackerRecord_', [orphan, { ...valid }], promoFx(), async () => validateTrackerRecord_(orphan, { ...valid }, await allOptions()))
  })
  it('computed and auto fields are never taken from the client', async () => {
    const input = { ...valid, total: '999', created_by: 'forged@x.y' }
    // 'bogus'-style unknown-field check passes because total/created_by ARE field ids;
    // the cleaned record simply must not carry them.
    await opsSame('validateTrackerRecord_', [t, input], promoFx(), async () => validateTrackerRecord_(t, input, await allOptions()))
  })
  it('an inactive dropdown option is not a choice', async () => {
    const f = promoFx({
      tables: {
        trackers: [trkRow(t)],
        tracker_fields: t.fields.map((x) => fldRow(t, x)),
        options: [{ list_key: 'tracker.promocodes.kind', value: 'Retired', sort: '', active: 'FALSE' }],
      },
    })
    await opsSame('validateTrackerRecord_', [t, { ...valid, kind: 'retired' }], f, async () => validateTrackerRecord_(t, { ...valid, kind: 'retired' }, await allOptions()))
  })
})

// =====================================================================
// Field definition validation
// =====================================================================

describe('normaliseFieldDef_ (Trackers.js: normaliseFieldDef_)', () => {
  const t = promoTracker()
  const defs: [string, Record<string, unknown>][] = [
    ['a text field', { label: 'Notes', type: 'text', required: true }],
    ['label trimmed + collapsed', { label: '  Weird   Label  ', type: 'text', required: false }],
    ['empty label', { label: '   ', type: 'text' }],
    ['label too long', { label: 'x'.repeat(61), type: 'text' }],
    ['label exactly 60', { label: 'x'.repeat(60), type: 'text' }],
    ['duplicate label (case/space-insensitive)', { label: 'promo  code', type: 'text' }],
    ['label colliding with a system column', { label: 'record_id', type: 'text' }],
    ['bad type', { label: 'X', type: 'boolean' }],
    ['dropdown without choices', { label: 'Pick', type: 'dropdown', choices: [] }],
    ['dropdown cleans its choices', { label: 'Pick', type: 'dropdown', choices: [' A ', 'a', 'Other', 'B'] }],
    ['dependent on a non-choice parent', { label: 'Sub', type: 'dependent', parentFieldId: 'promo_code', choicesByParent: { X: ['y'] } }],
    ['dependent on a missing parent', { label: 'Sub', type: 'dependent', parentFieldId: 'nope', choicesByParent: { X: ['y'] } }],
    ['dependent with no parent answers', { label: 'Sub', type: 'dependent', parentFieldId: 'region', choicesByParent: {} }],
    ['dependent with cleaned choicesByParent', { label: 'Sub', type: 'dependent', parentFieldId: 'region', choicesByParent: { ' Kuwait ': ['A', 'a', ''], Nowhere: [] } }],
    ['a money field', { label: 'Amount', type: 'money', required: false }],
    ['a date field', { label: 'When', type: 'date', required: false }],
    ['a link field', { label: 'Ref', type: 'link', required: false }],
  ]
  for (const [label, def] of defs) {
    it(label, async () => {
      await opsSame('normaliseFieldDef_', [t, def], promoFx(), async () => normaliseFieldDef_(t, def))
    })
  }
  it('editing keeps stored choices when none are sent', async () => {
    const editing = t.fields.find((f) => f.id === 'kind')!
    // 'Pick' with no choices while editing 'kind' (which already has Options) is allowed.
    await opsSame('normaliseFieldDef_', [t, { label: 'Kind Renamed', type: 'dropdown', choices: [] }, null, editing], promoFx(), async () =>
      normaliseFieldDef_(t, { label: 'Kind Renamed', type: 'dropdown', choices: [] }, null, editing),
    )
  })
})

// =====================================================================
// Registry
// =====================================================================

describe('trackerRegistry_ (Trackers.js: trackerRegistry_)', () => {
  /**
   * The port's trackerFromRow_ exposes ownerEmail (owner_email exists in the
   * Postgres registry); the legacy trackerFromRow_ never surfaces it. Nothing in
   * either page output reads it — strip it for the byte-compare.
   */
  const stripOwner = (reg: unknown) => {
    const r = JSON.parse(JSON.stringify(reg)) as { order: string[]; byId: Record<string, Record<string, unknown>> }
    r.order.forEach((id) => delete r.byId[id].ownerEmail)
    return r
  }
  const sameReg = async (f: OpsFx) => {
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('trackerRegistry_', [], fixture)
    const portRes = await portCall(() => trackerRegistry_())
    expectSame({ ok: stripOwner(portRes.ok), err: portRes.err }, { ok: stripOwner(legacyRes.ok), err: legacyRes.err }, 'trackerRegistry_')
  }
  it('a seeded registry reads identically (order, dedupe, fields sorted, archived skipped)', async () => {
    const a = promoTracker()
    const b: Tracker = {
      ...a,
      id: 'strikes',
      name: 'Customer strikes',
      spreadsheetId: 'strike-ss',
      tab: 'Responses',
      formBacked: false,
      recordIdFormat: '',
      submittedByHeader: 'Email Address',
      submittedAtHeader: 'Timestamp',
      fields: [{ id: 'customer_profile', label: 'Customer Profile', header: 'Customer Profile', type: 'text', required: true, listKey: '', parentFieldId: '', auto: '', position: 1 }],
    }
    const dead: Tracker = { ...b, id: 'archived_one', name: 'Archived', archived: true }
    const f = fx({
      tables: {
        trackers: [trkRow(a), trkRow(dead), trkRow(b), trkRow(b)], // a dup + an archived row are skipped
        tracker_fields: [
          // positions out of order: sorted by position on read
          fldRow(a, { ...a.fields[3], position: 4 }),
          fldRow(a, { ...a.fields[0], position: 1 }),
          fldRow(a, { ...a.fields[1], position: 2 }),
          fldRow(a, { ...a.fields[2], position: 3 }),
          fldRow(b, { ...b.fields[0], position: 1 }),
          fldRow(b, { id: 'retired_field', label: 'Retired', type: 'text', position: 2, active: false }), // inactive: skipped
          fldRow(dead, { id: 'ghost', label: 'Ghost', type: 'text', position: 1 }), // no tracker: skipped
        ],
      },
    })
    await sameReg(f)
  })
  it('a fully seeded registry equals the built-in shape field-for-field', async () => {
    await sameReg(promoFx())
  })
  it('missing registry tables: legacy seeds the built-ins, the port stays empty (documented gap)', async () => {
    // Trackers.js seeds the registry from BUILTIN_TRACKERS when the tabs do not
    // exist; the port's migration did that once, WITHOUT the field rows, so an
    // empty/missing registry can never be re-seeded by the port.
    const f = fx({ missingTables: ['trackers', 'tracker_fields'] })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('trackerRegistry_', [], fixture)
    const portRes = await portCall(() => trackerRegistry_())
    expect(portRes.err).toBeUndefined()
    const portReg = portRes.ok as { order: string[]; byId: Record<string, Tracker> }
    const legacyReg = legacyRes.ok as { order: string[]; byId: Record<string, Tracker> }
    expect(portReg.order).toEqual([])
    expect(legacyReg.order.length).toBeGreaterThan(0)
    // Every built-in the legacy seed writes must have fields — the port's seed
    // migration never wrote them, which is the recorded gap.
    expect(legacyReg.order.some((id) => legacyReg.byId[id].fields.length > 0)).toBe(true)
    expect(legacyReg.order).toContain('refund_ledger')
  })
})

// =====================================================================
// readTrackerData_ (the read seam)
// =====================================================================

describe('readTrackerData_ (Trackers.js: readTrackerData_)', () => {
  const t = promoTracker()
  const user: PlatformUser = { email: 'agent@dabdoob.com', name: 'Andy Agent', role: 'agent', tlEmail: null }
  const admin: PlatformUser = { email: 'admin@dabdoob.com', name: 'Admin Person', role: 'admin', tlEmail: null }

  it('rows map by header text; blanks skipped; choices attached', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    await opsSame('readTrackerData_', [t, admin], f, async () => readTrackerData_(t, admin))
  })

  it('an agent without view-all sees only their own rows', async () => {
    const f = promoFx({
      spreadsheets: {
        'promo-ss': {
          'Form Responses 1': [
            ['Promo Code', 'Email Address'],
            ['A', 'agent@dabdoob.com'],
            ['B', 'agent2@dabdoob.com'],
            ['C', ''], // outside the form: "outside" rows are hidden from own-rows readers too
          ],
        },
      },
      tables: {
        trackers: [trkRow(t)],
        // Only the fields the sheet actually has map; missing headers fail closed into headerProblems.
        tracker_fields: [fldRow(t, { ...t.fields[0], position: 1 })],
      },
    })
    await opsSame('readTrackerData_', [t, user], f, async () => readTrackerData_(t, user))
  })

  it('a missing mapped header fails closed into headerProblems with no rows', async () => {
    const f = promoFx({
      spreadsheets: {
        'promo-ss': {
          'Form Responses 1': [
            ['Promo Code', 'record_id'], // every field column except promo_code is missing
            ['A', 'OL1'],
          ],
        },
      },
    })
    await opsSame('readTrackerData_', [t, admin], f, async () => readTrackerData_(t, admin))
  })

  it('a missing tab throws the same error', async () => {
    const f = promoFx({ spreadsheets: { 'promo-ss': {} } })
    await opsSame('readTrackerData_', [t, admin], f, async () => readTrackerData_(t, admin))
  })

  it('Date cells come back as Kuwait text; record ids fall back to row-N', async () => {
    const f = promoFx({
      spreadsheets: {
        'promo-ss': {
          'Form Responses 1': [
            ['Start Date', 'Promo Code', 'record_id', 'Email Address', 'Timestamp'],
            ['@@ms:' + NOW, 'D1', '', 'agent@dabdoob.com', '@@ms:' + (NOW - 7200000)],
            ['@@ms:' + (NOW - 86400000), 'D2', 'OL9', 'agent2@dabdoob.com', '@@ms:' + NOW],
          ],
        },
      },
      tables: {
        trackers: [trkRow(t)],
        tracker_fields: [fldRow(t, { ...t.fields[5], position: 1 }), fldRow(t, { ...t.fields[0], position: 2 })],
      },
    })
    await opsSame('readTrackerData_', [t, admin], f, async () => readTrackerData_(t, admin))
  })

  it('rows over the cap are flagged limited and the newest 300 come back reversed', async () => {
    const rows: unknown[][] = [['Promo Code', 'record_id']]
    for (let i = 1; i <= TRACKER_MAX_ROWS + 5; i++) rows.push(['C' + i, 'OL' + i])
    const f = promoFx({
      spreadsheets: { 'promo-ss': { 'Form Responses 1': rows } },
      tables: { trackers: [trkRow(t)], tracker_fields: [fldRow(t, { ...t.fields[0], position: 1 })] },
    })
    await opsSame('readTrackerData_', [t, admin], f, async () => readTrackerData_(t, admin))
  })

  it('no access throws identically', async () => {
    const guest: PlatformUser = { email: 'outsider@dabdoob.com', name: 'Out', role: 'unknown', tlEmail: null }
    await opsSame('readTrackerData_', [t, guest], promoFx({ spreadsheets: promoSheet() }), async () => readTrackerData_(t, guest))
  })
})

// =====================================================================
// The page facades
// =====================================================================

describe('getTrackersPage / getTrackerRecords (Trackers.js)', () => {
  it('the full page payload matches for an admin', async () => {
    await opsSame('getTrackersPage', ['promocodes'], promoFx({ spreadsheets: promoSheet() }), () => getTrackersPage('promocodes'))
  })
  it('defaults to the first tracker when none is chosen', async () => {
    await opsSame('getTrackersPage', [undefined], promoFx({ spreadsheets: promoSheet() }), () => getTrackersPage(undefined))
  })
  it('an agent sees only trackers they can open', async () => {
    const f = promoFx({
      userEmail: 'agent@dabdoob.com',
      spreadsheets: promoSheet(),
      tables: {
        trackers: [trkRow(promoTracker()), trkRow({ ...promoTracker(), id: 'tl_only', name: 'TL Only', viewerRoles: ['admin', 'tl'], editorRoles: ['admin', 'tl'] })],
        tracker_fields: promoTracker().fields.map((x) => fldRow(promoTracker(), x)).concat(promoTracker().fields.map((x) => fldRow({ ...promoTracker(), id: 'tl_only' }, { ...x }))),
        options: [],
      },
    })
    await opsSame('getTrackersPage', [undefined], f, () => getTrackersPage(undefined))
  })
  it('an unknown caller is refused identically', async () => {
    const f = promoFx({ userEmail: 'outsider@dabdoob.com', spreadsheets: promoSheet() })
    await opsSame('getTrackersPage', ['promocodes'], f, () => getTrackersPage('promocodes'))
  })
  it('getTrackerRecords reads the same data', async () => {
    await opsSame('getTrackerRecords', ['promocodes'], promoFx({ spreadsheets: promoSheet() }), () => getTrackerRecords('promocodes'))
  })
  it('a read-only tracker is listed but refuses records', async () => {
    const ledger: Tracker = { ...promoTracker(), id: 'refund_ledger', name: 'Refund calculator backend', accessMode: 'view_only', spreadsheetId: REFUND_LEDGER_SPREADSHEET_ID }
    const f = fx({
      tables: {
        trackers: [trkRow(ledger)],
        tracker_fields: ledger.fields.map((x) => fldRow(ledger, x)),
      },
      spreadsheets: {
        [REFUND_LEDGER_SPREADSHEET_ID]: {
          'Form Responses 1': [['Promo Code', 'record_id'], ['R1', 'RL1']],
        },
      },
    })
    await opsSame('getTrackersPage', ['refund_ledger'], f, () => getTrackersPage('refund_ledger'))
    await opsSame('addTrackerRecord', ['refund_ledger', { promo_code: 'X', kind: 'Fixed', value: '1' }], f, () =>
      addTrackerRecord('refund_ledger', { promo_code: 'X', kind: 'Fixed', value: '1' }),
    )
  })
})

// =====================================================================
// Writes
// =====================================================================

describe('addTrackerRecord (Trackers.js: addTrackerRecord / writeTrackerRow_ / nextFormattedId_)', () => {
  const t = promoTracker()
  const values = {
    promo_code: '  SALE30 ',
    kind: 'percentage',
    value: '1,234.5',
    cap_kd: '10.5',
    link: 'https://x.y/t',
    start: '2026-11-02',
    region: 'KUWAIT',
    city: 'kuwait city',
  }
  it('writes the same cleaned cells + formatted id and returns the same envelope', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('addTrackerRecord', ['promocodes', values], fixture)
    const portRes = await portCall(() => addTrackerRecord('promocodes', values))
    expectSame(portRes, legacyRes, 'addTrackerRecord')
    // Physical write parity: the row the legacy fake sheet now holds vs the io's row.
    const legacyCells = opsSheetCells('promo-ss', 'Form Responses 1')
    const t2 = { ...t }
    const portLines = (await portCall(async () => {
      const io = (await import('@/features/cx-operations/lib/trackers')).getTrackerSheetIo()!
      return io.lines(t2)
    })).ok as unknown[][]
    const legacyLast = legacyCells[legacyCells.length - 1]
    const portLast = portLines[portLines.length - 1]
    // Compare cell-for-cell (Dates serialised by JSON on the legacy side).
    expect(json(portLast)).toEqual(json(legacyLast))
  })
  it('a second record gets the next formatted id', async () => {
    const f = promoFx({
      spreadsheets: {
        'promo-ss': {
          'Form Responses 1': [
            ['Promo Code', 'record_id', 'Email Address', 'Timestamp'],
            ['A', 'OL7', 'a@dabdoob.com', 'x'],
            ['B', 'OL15', 'b@dabdoob.com', 'x'],
            ['C', 'junk', 'c@dabdoob.com', 'x'],
          ],
        },
      },
    })
    await opsSame('addTrackerRecord', ['promocodes', { promo_code: 'Z' }], f, () => addTrackerRecord('promocodes', { promo_code: 'Z' }))
  })
  it('view-only tracker refuses before touching the sheet', async () => {
    const ro = { ...t, accessMode: 'view_only' }
    const f = fx({ tables: { trackers: [trkRow(ro)], tracker_fields: ro.fields.map((x) => fldRow(ro, x)) }, spreadsheets: promoSheet() })
    await opsSame('addTrackerRecord', ['promocodes', values], f, () => addTrackerRecord('promocodes', values))
  })
  it('an agent without add-rights is refused identically', async () => {
    const onlyView = { ...t, editorRoles: ['admin', 'tl'] }
    const f = promoFx({ userEmail: 'agent@dabdoob.com', tables: { trackers: [trkRow(onlyView)], tracker_fields: onlyView.fields.map((x) => fldRow(onlyView, x)) }, spreadsheets: promoSheet() })
    await opsSame('addTrackerRecord', ['promocodes', values], f, () => addTrackerRecord('promocodes', values))
  })
  it('a validation failure writes nothing on either side', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const bad = { ...values, value: 'not a number' }
    const { fixture, sheetIo } = opsInstall(f)
    const legacyRes = opsCall('addTrackerRecord', ['promocodes', bad], fixture)
    const portRes = await portCall(() => addTrackerRecord('promocodes', bad))
    expectSame(portRes, legacyRes, 'addTrackerRecord bad value')
    expect(opsSheetCells('promo-ss', 'Form Responses 1').length).toBe(3) // header + 1 data + 1 blank; nothing appended
    expect(sheetIo.appended.length).toBe(0)
  })
  it('a missing field column refuses with the same message', async () => {
    const f = promoFx({
      spreadsheets: {
        'promo-ss': { 'Form Responses 1': [['Promo Code', 'record_id', 'Email Address', 'Timestamp'], ['A', 'OL1', 'a@dabdoob.com', 'x']] },
      },
    })
    await opsSame('addTrackerRecord', ['promocodes', { promo_code: 'Z' }], f, () => addTrackerRecord('promocodes', { promo_code: 'Z' }))
  })
})

// =====================================================================
// Builder writes
// =====================================================================

describe('addTrackerField / updateTrackerField (Trackers.js)', () => {
  const t = promoTracker()
  it('addTrackerField writes the registry row, the sheet header and the choices', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const def = { label: 'Channel', type: 'dropdown', required: true, choices: ['WhatsApp', 'Calls'] }
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('addTrackerField', ['promocodes', def], fixture)
    const portRes = await portCall(() => addTrackerField('promocodes', def))
    expectSame(portRes, legacyRes, 'addTrackerField')
    // Field row parity (registry side effects are the real write).
    const legacyFields = opsTable('TrackerFields').filter((r) => String(r.tracker_id) === 'promocodes')
    const portFields = hubDb.tables.tracker_fields.filter((r) => String(r.tracker_id) === 'promocodes')
    expect(portFields.length).toBe(legacyFields.length)
    const added = (name: string, rows: Record<string, unknown>[]) => rows.filter((r) => String(r.label) === name)
    expect(added('Channel', portFields).length).toBe(1)
    // Seeded choices land in the same options list.
    const optsLegacy = opsOptions()
    const optsPort = await allOptions()
    const key = 'tracker.promocodes.' + String(added('Channel', portFields)[0].field_id)
    expect(optsPort[key]).toEqual(optsLegacy[key])
    // The new header was appended to the sheet on both sides.
    const legacyHeaders = opsSheetCells('promo-ss', 'Form Responses 1')[0]
    const ioHeaders = (await portCall(async () => (await import('@/features/cx-operations/lib/trackers')).getTrackerSheetIo()!.headers(t))).ok as string[]
    expect(ioHeaders.slice(0, legacyHeaders.length)).toEqual(legacyHeaders.map(String))
  })
  it('updateTrackerField renames a field and keeps the column header', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const def = { label: 'Promo Renamed', type: 'text', required: false }
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('updateTrackerField', ['promocodes', 'promo_code', def], fixture)
    const portRes = await portCall(() => updateTrackerField('promocodes', 'promo_code', def))
    expectSame(portRes, legacyRes, 'updateTrackerField')
    const legacyField = opsTable('TrackerFields').filter((r) => String(r.field_id) === 'promo_code')[0]
    const portField = hubDb.tables.tracker_fields.filter((r) => String(r.field_id) === 'promo_code')[0]
    // toCellValue_(false) stores the boolean false on both sides.
    expect({ label: portField.label, type: portField.type, required: portField.required }).toEqual({
      label: legacyField.label,
      type: legacyField.type,
      required: legacyField.required,
    })
  })
  it('updateTrackerField refuses for a non-builder identically', async () => {
    const f = promoFx({ userEmail: 'agent@dabdoob.com', spreadsheets: promoSheet() })
    await opsSame('updateTrackerField', ['promocodes', 'promo_code', { label: 'X', type: 'text' }], f, () =>
      updateTrackerField('promocodes', 'promo_code', { label: 'X', type: 'text' }),
    )
  })
  it('addTrackerField errors match for a bad def', async () => {
    await opsSame('addTrackerField', ['promocodes', { label: '   ', type: 'text' }], promoFx({ spreadsheets: promoSheet() }), () =>
      addTrackerField('promocodes', { label: '   ', type: 'text' }),
    )
  })
})

describe('createTracker (Trackers.js: createTracker)', () => {
  const def = {
    name: 'Refund QA',
    fields: [
      { label: 'Ticket', type: 'text', required: true },
      { label: 'Verdict', type: 'dropdown', required: true, choices: ['Pass', 'Fail'] },
      { label: 'Reason', type: 'dependent', required: false, parentFieldId: '#1', choicesByParent: { Fail: ['Wrong item', 'Late'] } },
    ],
  }
  /** The generated id contains a random suffix: pin both sides to the same value shape then mask it. */
  function maskId(res: { ok?: unknown; err?: string }, id: string) {
    return JSON.parse(JSON.stringify(res).split(id).join('@@TRACKER_ID@@'))
  }
  it('creates the same registry rows and returns the same page (id masked)', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('createTracker', [def], fixture)
    const portRes = await portCall(() => createTracker(def))
    const legacyId = (legacyRes.ok as { trackers?: { id: string }[] })?.trackers?.filter((x) => x.id.startsWith('refund_qa'))[0]?.id || ''
    const portId = (portRes.ok as { trackers?: { id: string }[] })?.trackers?.filter((x) => x.id.startsWith('refund_qa'))[0]?.id || ''
    expect(legacyId).toMatch(/^refund_qa_[0-9a-f]{4}$/)
    expect(portId).toMatch(/^refund_qa_[0-9a-z]{4}$/)
    expectSame(maskId(portRes, portId), maskId(legacyRes, legacyId), 'createTracker page')
    // Registry write parity (the Postgres rows vs the Trackers/TrackerFields tabs).
    const legacyT = opsTable('Trackers').filter((r) => String(r.name) === 'Refund QA')
    const portT = hubDb.tables.trackers.filter((r) => String(r.name) === 'Refund QA')
    expect(portT.length).toBe(1)
    expect(legacyT.length).toBe(1)
    const drop = (r: Record<string, unknown>) => {
      const rest = { ...(JSON.parse(JSON.stringify(r)) as Record<string, unknown>) }
      delete rest.tracker_id
      delete rest.submitted_by
      delete rest.submitted_at
      delete rest._row
      delete rest.id
      return rest
    }
    expect(drop(portT[0])).toEqual(drop(legacyT[0]))
    const legacyF = opsTable('TrackerFields').filter((r) => String(r.tracker_id) === legacyId)
    const portF = hubDb.tables.tracker_fields.filter((r) => String(r.tracker_id) === portId)
    expect(portF.length).toBe(legacyF.length)
    // The new tab exists in the legacy trackers spreadsheet with the field headers.
    const cells = opsSheetCells('__data__', 'Tracker Refund QA')
    expect(cells[0]).toEqual(['record_id', 'submitted_by', 'submitted_at', 'Ticket', 'Verdict', 'Reason'])
  })
  it('refuses a duplicate name identically', async () => {
    await opsSame('createTracker', [{ name: 'Promocodes', fields: [{ label: 'A', type: 'text' }] }], promoFx(), () =>
      createTracker({ name: 'Promocodes', fields: [{ label: 'A', type: 'text' }] }),
    )
  })
  it('refuses an empty field list identically', async () => {
    await opsSame('createTracker', [{ name: 'Empty', fields: [] }], promoFx(), () => createTracker({ name: 'Empty', fields: [] }))
  })
  it('refuses over-40 fields identically', async () => {
    const many = { name: 'Huge', fields: Array.from({ length: 41 }, (_, i) => ({ label: 'F' + i, type: 'text' })) }
    await opsSame('createTracker', [many], promoFx(), () => createTracker(many))
  })
  it('validates a dependent against earlier fields only', async () => {
    const bad = { name: 'Bad Dep', fields: [{ label: 'A', type: 'dependent', parentFieldId: '#2', choicesByParent: { X: ['y'] } }, { label: 'B', type: 'text' }] }
    await opsSame('createTracker', [bad], promoFx(), () => createTracker(bad))
  })
})

describe('setupTrackers (Trackers.js: setupTrackers)', () => {
  it('seeds the same dropdown choices from sheet data (return text differs by design)', async () => {
    // Legacy returns one report line per tracker; the port returns them joined
    // and drops the 'columns OK' text — a documented report-shape divergence.
    // What must match is the SEEDED Options store.
    const f = promoFx({
      spreadsheets: {
        'promo-ss': {
          'Form Responses 1': [
            ['Promo Code', 'Percentage or Fixed Value?', 'Region'],
            ['A', 'Percentage', 'Kuwait'],
            ['B', 'fixed', 'KSA'], // 'fixed' seeds a second spelling? no — dedupe is case-insensitive
            ['C', 'Other', ''],
          ],
        },
      },
      tables: {
        trackers: [trkRow(promoTracker())],
        tracker_fields: promoTracker().fields.map((x) => fldRow(promoTracker(), x)),
        options: [],
      },
    })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('setupTrackers', [], fixture)
    const portRes = await portCall(() => setupTrackers())
    expect(legacyRes.err).toBeUndefined()
    expect(portRes.err).toBeUndefined()
    // Every list the legacy seeded exists on the port side with the same values.
    const optsLegacy = opsOptions()
    const optsPort = await allOptions()
    Object.keys(optsLegacy).forEach((k) => {
      expect(optsPort[k]).toEqual(optsLegacy[k])
    })
  })
  it('refuses a non-admin identically', async () => {
    const f = promoFx({ userEmail: 'tl@dabdoob.com', spreadsheets: promoSheet() })
    await opsSame('setupTrackers', [], f, () => setupTrackers())
  })
})

// =====================================================================
// wave-2 extension — audits/operations.md §6 residual vectors
// =====================================================================

describe('money: decimals counted on the raw string (wave-2 extension)', () => {
  // TRACKER_MONEY_DECIMALS counts chars after '.' in the RAW input, not the parsed
  // number: '1,234.500' passes (dec=3), '1,234.5000' refuses (dec=4).
  const t = promoTracker()
  for (const cap of ['1,234.500', '1,234.5000', '1234.5000']) {
    it(JSON.stringify(cap), async () => {
      const input = { promo_code: 'S', kind: 'Fixed', value: '5', cap_kd: cap }
      await opsSame('validateTrackerRecord_', [t, input], promoFx(), async () => validateTrackerRecord_(t, input, await allOptions()))
    })
  }
})

describe('View as write refusals on all five write fns (wave-2 extension)', () => {
  const vaRow = (target: string) => ({
    owner_email: 'admin@dabdoob.com',
    action: 'start',
    target_email: target,
    app: 'operations',
    submitted_by: 'admin@dabdoob.com',
    submitted_at: ISO(NOW - H),
  })
  const vaFx = (over: OpsFx = {}, target = 'agent@dabdoob.com'): OpsFx => {
    const f = promoFx({ spreadsheets: promoSheet(), ...over })
    return { ...f, tables: { ...(f.tables || {}), view_as: [vaRow(target)] } }
  }

  it('addTrackerRecord: an agent target reaches the write, refused identically', async () => {
    await opsSame('addTrackerRecord', ['promocodes', { promo_code: 'S', kind: 'Fixed', value: '5' }], vaFx(), () =>
      addTrackerRecord('promocodes', { promo_code: 'S', kind: 'Fixed', value: '5' }),
    )
  })
  it('addTrackerField / updateTrackerField: a TL-builder target reaches the write, refused identically', async () => {
    const buildable = { ...promoTracker(), builderRoles: ['admin', 'tl'] }
    const f = vaFx(
      { tables: { trackers: [trkRow(buildable)], tracker_fields: buildable.fields.map((x) => fldRow(buildable, x)) } },
      'tl@dabdoob.com',
    )
    await opsSame('addTrackerField', ['promocodes', { label: 'Channel', type: 'dropdown', required: true, choices: ['Calls'] }], f, () =>
      addTrackerField('promocodes', { label: 'Channel', type: 'dropdown', required: true, choices: ['Calls'] }),
    )
    await opsSame('updateTrackerField', ['promocodes', 'promo_code', { label: 'Promo Renamed', type: 'text' }], f, () =>
      updateTrackerField('promocodes', 'promo_code', { label: 'Promo Renamed', type: 'text' }),
    )
  })
  it('createTracker: a TL target reaches the write, refused identically', async () => {
    const def = { name: 'Refund QA', fields: [{ label: 'Ticket', type: 'text', required: true }] }
    await opsSame('createTracker', [def], vaFx({}, 'tl@dabdoob.com'), () => createTracker(def))
  })
  it('setupTrackers: an admin target reaches the per-tracker writes — refused identically', async () => {
    // boss@ is a second admin (admin_emails), so requireRole passes. All five
    // builtin registry rows are already present (the mature-sheet state the port
    // is born into), so legacy seedTrackerRegistry_ appends nothing and the
    // read-only guard fires at each tracker's own first write — a per-tracker
    // error line on both sides. promocodes' sheet lacks record_id so its guard
    // fires inside ensureTrackerSystemColumns_; the four builtins' tabs are
    // unreachable and report the same missing-tab line on both sides.
    const builtins = [
      trkRow({ id: 'blocked_customers', name: 'Blocked customers', spreadsheetId: 'blt-bc', tab: 'Sheet1' }),
      trkRow({ id: 'operational_loss', name: 'Operational loss', spreadsheetId: 'blt-ol', tab: 'Sheet1' }),
      trkRow({ id: 'customer_strikes', name: 'Customer strikes', spreadsheetId: 'blt-cs', tab: 'Form Responses 1' }),
      trkRow({ id: 'refund_ledger', name: 'Refund calculator backend', spreadsheetId: 'blt-rl', tab: 'Refund Log', accessMode: 'view_only' }),
    ]
    const noSys = {
      'promo-ss': {
        'Form Responses 1': [
          ['Promo Code', 'Percentage or Fixed Value?', 'Value (Fixed or Percentage)', 'Cap', 'Terms Link', 'Start Date', 'Region', 'City', 'Created By', 'Email Address', 'Timestamp'],
          ['SALE10', 'Percentage', '10', '50', 'https://x.y/terms', '2026-10-01', 'Kuwait', 'Kuwait City', 'Andy Agent', 'agent@dabdoob.com', '@@ms:' + (NOW - 86400000)],
        ],
      },
    }
    const f = vaFx({ settings: { admin_emails: 'admin@dabdoob.com,boss@dabdoob.com' }, spreadsheets: noSys }, 'boss@dabdoob.com')
    // promoFx's `...over` replaces the whole `tables` object — mutate it so the
    // default TrackerFields/Options tabs survive (a missing tab makes legacy
    // seed the registry, and the seed write is refused before the loop runs).
    f.tables = { ...(f.tables || {}), trackers: [trkRow(promoTracker()), ...builtins] }
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('setupTrackers', [], fixture)
    const portRes = await portCall(() => setupTrackers())
    const legacyLines = legacyRes.ok as string[]
    expect(legacyLines.length).toBe(5)
    expect(legacyLines[0]).toBe('Promocodes: View as is read-only — exit to make changes.')
    expect(String(portRes.ok)).toBe(legacyLines.join('\n'))
  })
  it('ordering pin: an invalid call under view-as — both validate first now (audit #11 resolved)', async () => {
    // The port's blanket assertWritable used to fire before validation (audit
    // #11). The guards now sit at the first physical write, like vaWrap_, so an
    // invalid record reports the validation error under View as on both sides.
    const f = vaFx()
    await opsSame('addTrackerRecord', ['promocodes', { promo_code: 'S', kind: 'Fixed', value: 'not a number' }], f, () =>
      addTrackerRecord('promocodes', { promo_code: 'S', kind: 'Fixed', value: 'not a number' }),
    )
  })
})

describe('native tracker end-to-end via nativeIo (wave-2 extension)', () => {
  // A native tracker lives in tracker_records on the port; the oracle reads a
  // same-named tab inside the __data__ book (the trackers spreadsheet when
  // CC_TRACKERS_SPREADSHEET_ID is unset). We mirror both into the fixture.
  const native = ((): Tracker => ({
    id: 'qa_board',
    name: 'QA Board',
    storage: 'native',
    spreadsheetId: '',
    tab: 'Tracker QA Board',
    headerRow: 1,
    accessMode: 'edit',
    formBacked: false,
    recordIdHeader: 'record_id',
    recordIdFormat: 'TK-{n}',
    submittedByHeader: 'submitted_by',
    submittedAtHeader: 'submitted_at',
    viewerRoles: ['admin', 'tl', 'agent'],
    editorRoles: ['admin', 'tl', 'agent'],
    builderRoles: ['admin', 'tl'],
    ownerEmail: '',
    archived: false,
    fields: [
      { id: 'ticket', label: 'Ticket', header: 'Ticket', type: 'text', required: true, listKey: '', parentFieldId: '', auto: '', position: 1 },
      { id: 'verdict', label: 'Verdict', header: 'Verdict', type: 'dropdown', required: true, listKey: 'tracker.qa_board.verdict', parentFieldId: '', auto: '', position: 2 },
    ],
  }))()
  const nativeFx = (): OpsFx =>
    promoFx({
      tables: {
        trackers: [trkRow({ id: 'qa_board', name: 'QA Board', storage: 'native', spreadsheetId: '', tab: 'Tracker QA Board', recordIdFormat: 'TK-{n}', builderRoles: ['admin', 'tl'], viewerRoles: ['admin', 'tl', 'agent'], editorRoles: ['admin', 'tl', 'agent'] })],
        tracker_fields: native.fields.map((f) => fldRow(native, f)),
        options: [
          { list_key: 'tracker.qa_board.verdict', value: 'Pass', sort: '', active: true },
          { list_key: 'tracker.qa_board.verdict', value: 'Fail', sort: '', active: true },
        ],
        tracker_records: [
          { tracker_id: 'qa_board', record_id: 'TK-3', row_n: 2, submitted_by: 'agent@dabdoob.com', submitted_at: '2026-10-07T10:00:00.000Z', values: { ticket: 'T-1', verdict: 'Pass' } },
        ],
      },
      spreadsheets: {},
    })
  /** The legacy mirror tab (inside the oracle's trackers spreadsheet). */
  const nativeTab = (extraRows: unknown[][] = []): unknown[][] => [
    ['record_id', 'submitted_by', 'submitted_at', 'Ticket', 'Verdict'],
    ['TK-3', 'agent@dabdoob.com', '@@ms:' + Date.parse('2026-10-07T10:00:00Z'), 'T-1', 'Pass'],
    ...extraRows,
  ]
  const installNative = (f: OpsFx) => {
    const { fixture } = opsInstall(f)
    const data = (fixture.data = fixture.data || {})
    data['Tracker QA Board'] = nativeTab()
    return { fixture, data }
  }

  it('addTrackerRecord -> getTrackerRecords: row_n ordering, values jsonb, formatted ids', async () => {
    const { fixture, data } = installNative(nativeFx())
    const addLegacy = opsCall('addTrackerRecord', ['qa_board', { ticket: 'T-2', verdict: 'Fail' }], fixture)
    const addPort = await portCall(() => addTrackerRecord('qa_board', { ticket: 'T-2', verdict: 'Fail' }))
    expectSame(addPort, addLegacy, 'native addTrackerRecord')
    expect(addPort.ok).toEqual({ recordId: 'TK-4', submittedBy: 'admin@dabdoob.com', submittedAt: '2026-10-08T09:00:00.000Z' })
    // The port stored ONE tracker_records row with the values jsonb.
    const rec = (hubDb.tables.tracker_records || []).find((r) => r.record_id === 'TK-4')!
    expect(rec.row_n).toBe(3)
    expect(rec.values).toEqual({ ticket: 'T-2', verdict: 'Fail' })
    // The oracle wrote the same cells into its native tab.
    const legacyRow = opsTable('Tracker QA Board').find((r) => r.record_id === 'TK-4')!
    expect(legacyRow.submitted_by).toBe('admin@dabdoob.com')
    expect(legacyRow.Ticket).toBe('T-2')
    expect(legacyRow.Verdict).toBe('Fail')
    // __reset__ re-seeds __FIXTURES__ from the host fixture on every call, so the
    // read-back call feeds the oracle the tab cells it just wrote (the ISO Date
    // cell back as a '@@ms' marker). The port reads its own tracker_records.
    data['Tracker QA Board'] = (opsSheetCells('__data__', 'Tracker QA Board') as unknown[][]).map((r) =>
      r.map((c) => (typeof c === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(c) ? '@@ms:' + Date.parse(c) : c)),
    )
    // Records page reads both sides identically: newest first, 'yyyy-MM-dd HH:mm' Kuwait.
    const getLegacy = opsCall('getTrackerRecords', ['qa_board'], fixture)
    const getPort = await portCall(() => getTrackerRecords('qa_board'))
    expectSame(getPort, getLegacy, 'native getTrackerRecords')
    const rows = (getPort.ok as { rows: { recordId: string; submittedAt: string }[] }).rows
    expect(rows[0].recordId).toBe('TK-4')
    expect(rows[0].submittedAt).toBe('2026-10-08 12:00')
    expect(rows[1].submittedAt).toBe('2026-10-07 13:00')
  })
  it('a native field add is values-key only on the port (the tab column is a sheet concept)', async () => {
    // Legacy appends a physical column to the native tab; the port skips the header
    // write entirely ('native'). The stored field row + data read still match.
    const buildable = { ...native, builderRoles: ['admin', 'tl'] }
    const f = promoFx({
      tables: {
        trackers: [trkRow({ id: 'qa_board', name: 'QA Board', storage: 'native', spreadsheetId: '', tab: 'Tracker QA Board', recordIdFormat: 'TK-{n}', builderRoles: ['admin', 'tl'], viewerRoles: ['admin', 'tl', 'agent'], editorRoles: ['admin', 'tl', 'agent'] })],
        tracker_fields: native.fields.map((x) => fldRow(buildable, x)),
        options: [
          { list_key: 'tracker.qa_board.verdict', value: 'Pass', sort: '', active: true },
          { list_key: 'tracker.qa_board.verdict', value: 'Fail', sort: '', active: true },
        ],
        tracker_records: [
          { tracker_id: 'qa_board', record_id: 'TK-3', row_n: 2, submitted_by: 'agent@dabdoob.com', submitted_at: '2026-10-07T10:00:00.000Z', values: { ticket: 'T-1', verdict: 'Pass' } },
        ],
      },
      spreadsheets: {},
      userEmail: 'tl@dabdoob.com',
    })
    const { fixture } = installNative(f)
    const def = { label: 'Notes', type: 'text', required: false }
    const legacyRes = opsCall('addTrackerField', ['qa_board', def], fixture)
    const portRes = await portCall(() => addTrackerField('qa_board', def))
    expectSame(portRes, legacyRes, 'native addTrackerField')
    // Legacy appended the 'Notes' header; the port has no header row to grow.
    const legacyHeaders = opsSheetCells('__data__', 'Tracker QA Board')[0]
    expect(legacyHeaders[legacyHeaders.length - 1]).toBe('Notes')
  })
})

describe('updateTrackerField protection branches (wave-2 extension)', () => {
  const f = () => promoFx({ spreadsheets: promoSheet() })
  it('a child dependent pins the parent type', async () => {
    await opsSame('updateTrackerField', ['promocodes', 'region', { label: 'Region', type: 'text' }], f(), () =>
      updateTrackerField('promocodes', 'region', { label: 'Region', type: 'text' }),
    )
  })
  it('self-parenting resolves to the same dropdown-parent refusal on both sides', async () => {
    // normaliseFieldDef_ excludes the edited field from the parent list, so a
    // self-reference trips 'must depend on a dropdown field' before the
    // 'cannot depend on itself' line — identical ordering on both.
    await opsSame('updateTrackerField', ['promocodes', 'region', { label: 'Region', type: 'dependent', parentFieldId: 'region' }], f(), () =>
      updateTrackerField('promocodes', 'region', { label: 'Region', type: 'dependent', parentFieldId: 'region' }),
    )
  })
  it('computed and auto fields refuse edits identically', async () => {
    await opsSame('updateTrackerField', ['promocodes', 'total', { label: 'Total X', type: 'text' }], f(), () =>
      updateTrackerField('promocodes', 'total', { label: 'Total X', type: 'text' }),
    )
    await opsSame('updateTrackerField', ['promocodes', 'created_by', { label: 'Creator', type: 'text' }], f(), () =>
      updateTrackerField('promocodes', 'created_by', { label: 'Creator', type: 'text' }),
    )
  })
  it('a nonexistent (or inactive) field id refuses identically', async () => {
    await opsSame('updateTrackerField', ['promocodes', 'ghost', { label: 'X', type: 'text' }], f(), () =>
      updateTrackerField('promocodes', 'ghost', { label: 'X', type: 'text' }),
    )
    // active=FALSE is filtered at registry read on both sides -> same refusal.
    const t = promoTracker()
    const f2 = promoFx({
      spreadsheets: promoSheet(),
      tables: {
        trackers: [trkRow(t)],
        tracker_fields: t.fields.map((x) => fldRow(t, { ...x, active: x.id === 'city' ? false : true })),
      },
    })
    await opsSame('updateTrackerField', ['promocodes', 'city', { label: 'City', type: 'dependent', parentFieldId: 'region' }], f2, () =>
      updateTrackerField('promocodes', 'city', { label: 'City', type: 'dependent', parentFieldId: 'region' }),
    )
  })
})

describe('normaliseFieldDef_ keptDep path (wave-2 extension)', () => {
  // Editing a dependent field WITHOUT resending choicesByParent keeps the stored
  // dep lists: total==0 but keptDep is true (same parent), so no throw.
  const t = promoTracker()
  const editing = t.fields.filter((x) => x.id === 'city')[0] as unknown as TrackerField
  it('direct: no choicesByParent, same parent -> kept, no throw', async () => {
    const def = { label: 'City', type: 'dependent', required: false, parentFieldId: 'region' }
    await opsSame('normaliseFieldDef_', [t, def, null, editing], promoFx(), async () => normaliseFieldDef_(t, def, null, editing))
  })
  it('via updateTrackerField: the dep options survive the edit on both sides', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const { fixture } = opsInstall(f)
    const def = { label: 'City', type: 'dependent', required: false, parentFieldId: 'region' }
    const legacyRes = opsCall('updateTrackerField', ['promocodes', 'city', def], fixture)
    const portRes = await portCall(() => updateTrackerField('promocodes', 'city', def))
    expectSame(portRes, legacyRes, 'updateTrackerField keptDep')
    // The seeded dep lists are still there (Kuwait City / Riyadh).
    const legacyOpts = opsOptions()
    const portOpts = await allOptions()
    Object.keys(legacyOpts).forEach((k) => expect(portOpts[k]).toEqual(legacyOpts[k]))
  })
})

describe('ensureTrackerSystemColumns_ external path (wave-2 extension)', () => {
  it('missing sys headers append at the first blank-tail position on both sides', async () => {
    // A sheet with field headers + a trailing blank column and NO sys columns.
    const sheetNoSys = {
      'promo-ss': {
        'Form Responses 1': [
          ['Promo Code', 'Percentage or Fixed Value?', 'Value (Fixed or Percentage)', 'Region', 'City', ''],
          ['SALE10', 'Percentage', '10', 'Kuwait', 'Kuwait City', ''],
        ],
      },
    }
    const f = promoFx({ spreadsheets: sheetNoSys })
    const { fixture, sheetIo } = opsInstall(f)
    const legacyRes = opsCall('addTrackerRecord', ['promocodes', { promo_code: 'B', kind: 'Fixed', value: '7', region: 'Kuwait', city: 'Kuwait City' }], fixture)
    const portRes = await portCall(() => addTrackerRecord('promocodes', { promo_code: 'B', kind: 'Fixed', value: '7', region: 'Kuwait', city: 'Kuwait City' }))
    expectSame(portRes, legacyRes, 'addTrackerRecord sys-col append')
    // Headers: the blank tail is overwritten by record_id / Email Address / Timestamp.
    const legacyHeaders = opsSheetCells('promo-ss', 'Form Responses 1')[0]
    const portHeaders = await sheetIo.io.headers(promoTracker())
    expect(portHeaders).toEqual(legacyHeaders.map(String))
    expect(portHeaders.slice(-3)).toEqual(['record_id', 'Email Address', 'Timestamp'])
  })
})

describe('readTrackerData_ boundaries (wave-2 extension)', () => {
  // promoSheet() lacks the computed field's header, so mapTrackerColumns_ fails
  // closed there (headerProblems, rows []). These sheets add 'Total (computed)'
  // so the vectors exercise the real read path on both sides.
  const bigSheet = (n: number) => {
    const rows: unknown[][] = [[...promoSheet()['promo-ss']['Form Responses 1'][0], 'Total (computed)']]
    for (let i = 1; i <= n; i++) {
      rows.push(['P' + i, 'Fixed', '5', '', '', '', 'Kuwait', 'Kuwait City', 'X', 'R' + i, i === n ? 'AGENT@dabdoob.com' : 'agent@dabdoob.com', '@@ms:' + (NOW - i * 60000), ''])
    }
    return { 'promo-ss': { 'Form Responses 1': rows } }
  }
  it('exactly 300 rows is not limited; 301 is capped and reversed', async () => {
    for (const n of [TRACKER_MAX_ROWS, TRACKER_MAX_ROWS + 1]) {
      await opsSame('getTrackerRecords', ['promocodes'], promoFx({ spreadsheets: bigSheet(n) }), () => getTrackerRecords('promocodes'), 'rows ' + n)
    }
  })
  it('an agent sees only her own rows; submittedBy is case-folded', async () => {
    const f = promoFx({ spreadsheets: bigSheet(3), userEmail: 'agent@dabdoob.com' })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('getTrackerRecords', ['promocodes'], fixture)
    const portRes = await portCall(() => getTrackerRecords('promocodes'))
    expectSame(portRes, legacyRes, 'agent rows')
    const rows = (portRes.ok as { rows: { recordId: string; submittedBy: string }[] }).rows
    expect(rows.every((r) => r.submittedBy === 'agent@dabdoob.com')).toBe(true)
    expect(rows.length).toBe(3) // 'AGENT@dabdoob.com' folded to her own
  })
  it('outside rows keep their flag; total counts pre-slice', async () => {
    const sheet = {
      'promo-ss': {
        'Form Responses 1': [
          [...promoSheet()['promo-ss']['Form Responses 1'][0], 'Total (computed)'],
          ['A', 'Fixed', '5', '', '', '', 'Kuwait', 'Kuwait City', 'X', 'R1', '', '@@ms:' + (NOW - 60000), ''], // no submitted_by -> outside
          ['B', 'Fixed', '5', '', '', '', 'Kuwait', 'Kuwait City', 'X', 'R2', 'agent@dabdoob.com', '@@ms:' + NOW, ''],
        ],
      },
    }
    await opsSame('getTrackerRecords', ['promocodes'], promoFx({ spreadsheets: sheet }), () => getTrackerRecords('promocodes'))
    const res = await portCall(() => getTrackerRecords('promocodes'))
    const out = res.ok as { rows: { outside: boolean }[]; total: number }
    expect(out.total).toBe(2)
    expect(out.rows.filter((r) => r.outside).length).toBe(1)
  })
})

describe('trackerRegistry_ row-parsing edges (wave-2 extension)', () => {
  it('position non-numeric->0, column_header falls back to label, active variants', async () => {
    const t = promoTracker()
    const f = promoFx({
      tables: {
        trackers: [trkRow(t), trkRow({ id: 'archived_one', name: 'Old', archived: true })],
        tracker_fields: [
          { ...fldRow(t, { id: 'f_alpha', position: 9, label: 'Alpha' }), column_header: '' }, // '' -> registry falls back to label
          { ...fldRow(t, { id: 'f_bad_pos', position: 99, label: 'BadPos' }), position: 'abc' }, // -> 0, sorts first
          { ...fldRow(t, { id: 'f_inactive', position: 5, label: 'Inactive' }), active: 'FALSE' }, // excluded
          { ...fldRow(t, { id: 'f_active_lower', position: 6, label: 'ActiveLower' }), active: 'false' }, // excluded
        ],
      },
    })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('trackerRegistry_', [], fixture)
    const portRes = await portCall(() => trackerRegistry_())
    expectSame(portRes, legacyRes, 'trackerRegistry_ edges')
    const reg = portRes.ok as { order: string[]; byId: Record<string, Tracker> }
    expect(reg.order).toEqual(['promocodes']) // archived filtered
    const ids = reg.byId.promocodes.fields.map((x) => x.id)
    expect(ids[0]).toBe('f_bad_pos') // 'abc' -> position 0 -> first
    expect(ids).not.toContain('f_inactive')
    expect(ids).not.toContain('f_active_lower')
    const alpha = reg.byId.promocodes.fields.find((x) => x.id === 'f_alpha')!
    expect(alpha.header).toBe('Alpha') // '' fell back to the label
  })
})

describe('getTrackersPage residual vectors (wave-2 extension)', () => {
  it('a chosen tracker whose tab is missing: error string + current null, identical', async () => {
    // The sheet exists but the tab does not -> both sides throw the same line
    // into `error` and keep current null.
    const f = promoFx({ spreadsheets: { 'promo-ss': { OtherTab: [['x']] } } })
    await opsSame('getTrackersPage', ['promocodes'], f, () => getTrackersPage('promocodes'))
    const res = await portCall(() => getTrackersPage('promocodes'))
    const out = res.ok as { current: unknown; error: string }
    expect(out.current).toBeNull()
    expect(out.error).toBe('The tab "Form Responses 1" of Promocodes is missing. Ask an admin to check the source sheet.')
  })
  it('canCreate is false for an agent', async () => {
    const f = promoFx({ spreadsheets: promoSheet(), userEmail: 'agent@dabdoob.com' })
    await opsSame('getTrackersPage', [], f, () => getTrackersPage())
    const res = await portCall(() => getTrackersPage())
    expect((res.ok as { canCreate: boolean }).canCreate).toBe(false)
  })
})

describe('setupTrackers residual branches (wave-2 extension)', () => {
  it('an unreachable tracker reports its error line identically; skips (long/other/dup/non-dropdown) hold', async () => {
    const ledger = {
      id: 'ledger', name: 'Ledger', storage: 'external', spreadsheetId: 'ledger-ss', tab: 'Gone',
      headerRow: 1, accessMode: 'edit', formBacked: false, recordIdHeader: 'record_id', recordIdFormat: '',
      submittedByHeader: 'submitted_by', submittedAtHeader: 'submitted_at',
      viewerRoles: ['admin', 'tl'], editorRoles: ['admin', 'tl'], builderRoles: ['admin'], ownerEmail: '', archived: false, fields: [],
    } as Tracker
    const sheet = {
      'promo-ss': {
        'Form Responses 1': [
          ['Promo Code', 'Percentage or Fixed Value?', 'Value (Fixed or Percentage)', 'Cap', 'Terms Link', 'Start Date', 'Region', 'City', 'Created By', 'record_id', 'Email Address', 'Timestamp'],
          ['A', 'Percentage', '10', '', '', '', 'Kuwait', 'Kuwait City', 'X', 'OL1', 'a@x', '@@ms:' + NOW],
          ['B', 'fixed', '10', '', '', '', 'KSA', 'Riyadh', 'X', 'OL2', 'a@x', '@@ms:' + NOW],
          ['C', 'Other', '10', '', '', '', 'other', 'Riyadh', 'X', 'OL3', 'a@x', '@@ms:' + NOW], // 'other' skipped
          ['D', 'Fixed', '10', '', '', '', 'KSA', 'Riyadh', 'X', 'OL4', 'a@x', '@@ms:' + NOW], // 'KSA' dup (case-insensitive)
          ['E', 'x'.repeat(200), '10', '', '', '', 'Q'.repeat(200), 'Riyadh', 'X', 'OL5', 'a@x', '@@ms:' + NOW], // > OPTION_MAX_LEN skipped
        ],
      },
      // no 'ledger-ss' spreadsheet -> the ledger's tab is unreachable
    }
    const t = promoTracker()
    const f = promoFx({
      spreadsheets: sheet,
      tables: {
        trackers: [trkRow(t), trkRow(ledger)],
        tracker_fields: t.fields.map((x) => fldRow(t, x)),
        options: [],
      },
    })
    const { fixture } = opsInstall(f)
    const legacyRes = opsCall('setupTrackers', [], fixture)
    const portRes = await portCall(() => setupTrackers())
    const legacyLines = legacyRes.ok as string[]
    // The unreachable tracker's error line is byte-identical (the io throws the
    // same missing-tab message the oracle's sheet raises).
    const ledgerLine = legacyLines.find((l) => l.indexOf('Ledger:') === 0)!
    expect(ledgerLine).toBe('Ledger: The tab "Gone" of Ledger is missing. Ask an admin to check the source sheet.')
    expect(String(portRes.ok || '')).toContain(ledgerLine)
    // Seeded options identical on both sides (long/'other'/dup all skipped).
    const optsLegacy = opsOptions()
    const optsPort = await allOptions()
    Object.keys(optsLegacy).forEach((k) => expect(optsPort[k]).toEqual(optsLegacy[k]))
    expect(optsPort['tracker.promocodes.region']).toEqual(['Kuwait', 'KSA'])
  })
})

describe('addTrackerField bound path (wave-2 extension)', () => {
  it('a label that already sits in the sheet binds instead of appending a column', async () => {
    // 'Notes' exists as a sheet header but maps no field -> addTrackerColumn_ 'bound'.
    // The sheet carries every mapped field header (incl. 'Total (computed)') so
    // the post-add read has no missing columns on either side.
    const sheetWithExtra = {
      'promo-ss': {
        'Form Responses 1': [
          [...promoSheet()['promo-ss']['Form Responses 1'][0], 'Total (computed)', 'Notes'],
          ['A', 'Fixed', '5', '', '', '', 'Kuwait', 'Kuwait City', 'X', 'OL1', 'a@x', '@@ms:' + NOW, '', 'pre-existing note'],
        ],
      },
    }
    const buildable = { ...promoTracker(), builderRoles: ['admin'] }
    const f = promoFx({
      spreadsheets: sheetWithExtra,
      tables: { trackers: [trkRow(buildable)], tracker_fields: buildable.fields.map((x) => fldRow(buildable, x)) },
    })
    const { fixture, sheetIo } = opsInstall(f)
    const legacyRes = opsCall('addTrackerField', ['promocodes', { label: 'Notes', type: 'text', required: false }], fixture)
    const portRes = await portCall(() => addTrackerField('promocodes', { label: 'Notes', type: 'text', required: false }))
    expectSame(portRes, legacyRes, 'addTrackerField bound')
    // No second 'Notes' column was written on either side.
    const legacyHeaders = opsSheetCells('promo-ss', 'Form Responses 1')[0]
    const portHeaders = await sheetIo.io.headers(promoTracker())
    expect(portHeaders.filter((h) => h === 'Notes').length).toBe(1)
    expect(legacyHeaders.filter((h) => String(h) === 'Notes').length).toBe(1)
    // The fresh read picks the pre-existing cell up as the field's value.
    const data = portRes.ok as { fields: { id: string }[]; rows: { values: Record<string, unknown> }[] }
    const nf = data.fields[data.fields.length - 1]
    expect(data.rows[0].values[nf.id]).toBe('pre-existing note')
  })
})

describe('addTrackerRecord residuals (wave-2 extension)', () => {
  it("an auto field that is not 'actor_name' is never written", async () => {
    // auto:'formula' is still an auto field: validateTrackerRecord_ never reads
    // client input for it and writeTrackerRow_ writes nothing — the sheet cell
    // stays ''. A submitted key for it is an unknown-key refusal? No — it IS a
    // known field id, so validation passes and the write simply skips it.
    const t = {
      ...promoTracker(),
      fields: [...promoTracker().fields, { id: 'auto_calc', label: 'Auto Calc', header: 'Auto Calc', type: 'text' as const, required: false, listKey: '', parentFieldId: '', auto: 'formula', position: 11 }],
    }
    const sheet = {
      'promo-ss': {
        'Form Responses 1': [
          [...promoSheet()['promo-ss']['Form Responses 1'][0], 'Total (computed)', 'Auto Calc'],
          ['SALE10', 'Percentage', '10', '50', 'https://x.y/t', '2026-10-01', 'Kuwait', 'Kuwait City', 'Andy', 'OL4', 'agent@dabdoob.com', '@@ms:' + (NOW - 86400000), '9', 'kept'],
        ],
      },
    }
    const f = promoFx({ spreadsheets: sheet })
    // Keep the default Options rows (kind: 'Fixed' must validate) — promoFx's
    // `...over` would replace the whole `tables` object, so mutate it instead.
    f.tables = { ...(f.tables || {}), trackers: [trkRow(t)], tracker_fields: t.fields.map((x) => fldRow(t, x)) }
    const { fixture, sheetIo } = opsInstall(f)
    const legacyRes = opsCall('addTrackerRecord', ['promocodes', { promo_code: 'B', kind: 'Fixed', value: '5' }], fixture)
    const portRes = await portCall(() => addTrackerRecord('promocodes', { promo_code: 'B', kind: 'Fixed', value: '5' }))
    expectSame(portRes, legacyRes, 'auto!=actor_name not written')
    const autoIdx = promoSheet()['promo-ss']['Form Responses 1'][0].length + 1 // 'Auto Calc' = last column
    const rows = await sheetIo.io.lines(t)
    const last = rows[rows.length - 1]
    expect(String(last[autoIdx])).toBe('') // Auto Calc cell untouched
    const legacyCells = opsSheetCells('promo-ss', 'Form Responses 1')
    const legacyLast = legacyCells[legacyCells.length - 1]
    expect(cellStr(legacyLast, autoIdx)).toBe('') // sparse legacy row: never written
    expect(cellStr(last, autoIdx - 1)).toBe('') // Total (computed) never written either
    expect(cellStr(legacyLast, autoIdx - 1)).toBe('')
  })
  it('\r\n input normalises to \n before storing', async () => {
    const input = { promo_code: 'A\r\nB', kind: 'Fixed', value: '5' }
    // Full header incl. 'Total (computed)' so the write reaches the row.
    const sheet = { 'promo-ss': { 'Form Responses 1': [[...promoSheet()['promo-ss']['Form Responses 1'][0], 'Total (computed)']] } }
    const f = promoFx({ spreadsheets: sheet })
    const { fixture, sheetIo } = opsInstall(f)
    const legacyRes = opsCall('addTrackerRecord', ['promocodes', input], fixture)
    const portRes = await portCall(() => addTrackerRecord('promocodes', input))
    expectSame(portRes, legacyRes, 'crlf normalisation')
    const rows = await sheetIo.io.lines(promoTracker())
    expect(String(rows[rows.length - 1][0])).toBe('A\nB')
    const legacyCells = opsSheetCells('promo-ss', 'Form Responses 1')
    expect(cellStr(legacyCells[legacyCells.length - 1], 0)).toBe('A\nB')
  })
  it('recordIdFormat {n}=1 when no prior ids exist', async () => {
    const empty = { 'promo-ss': { 'Form Responses 1': [[...promoSheet()['promo-ss']['Form Responses 1'][0], 'Total (computed)']] } }
    const f = promoFx({ spreadsheets: empty })
    const { port } = await opsSame('addTrackerRecord', ['promocodes', { promo_code: 'B', kind: 'Fixed', value: '5' }], f, () =>
      addTrackerRecord('promocodes', { promo_code: 'B', kind: 'Fixed', value: '5' }),
    )
    expect((port.ok as { recordId: string }).recordId).toBe('OL1')
  })
})

describe('dependent option round-trip via updateTrackerField (wave-2 extension)', () => {
  it('choicesByParent seeds hashed tracker.<id>.<field>.<hash> lists; the validator then accepts them', async () => {
    const f = promoFx({ spreadsheets: promoSheet() })
    const { fixture } = opsInstall(f)
    const def = { label: 'City', type: 'dependent', required: false, parentFieldId: 'region', choicesByParent: { Kuwait: ['Jahra'], KSA: ['Jeddah'] } }
    const legacyRes = opsCall('updateTrackerField', ['promocodes', 'city', def], fixture)
    const portRes = await portCall(() => updateTrackerField('promocodes', 'city', def))
    expectSame(portRes, legacyRes, 'dep-key option seeding')
    const kuwaitKey = trackerDepKey_('promocodes', 'city', 'Kuwait')
    expect((await allOptions())[kuwaitKey]).toContain('Jahra')
    expect(opsOptions()[kuwaitKey]).toContain('Jahra')
    // Round-trip: 'Jahra' under the hashed dep key is a valid answer for
    // region=Kuwait on both sides (and still refused for KSA).
    const t = promoTracker()
    const depFx = promoFx({
      spreadsheets: promoSheet(),
      tables: {
        options: [
          { list_key: 'tracker.promocodes.kind', value: 'Percentage', sort: '', active: true },
          { list_key: 'tracker.promocodes.kind', value: 'Fixed', sort: '', active: true },
          { list_key: 'tracker.promocodes.region', value: 'Kuwait', sort: '', active: true },
          { list_key: 'tracker.promocodes.region', value: 'KSA', sort: '', active: true },
          { list_key: kuwaitKey, value: 'Jahra', sort: '', active: true },
        ],
      },
    })
    const input = { promo_code: 'S', kind: 'Fixed', value: '5', region: 'Kuwait', city: 'Jahra' }
    await opsSame('validateTrackerRecord_', [t, input], depFx, async () => validateTrackerRecord_(t, input, await allOptions()))
    const bad = { ...input, region: 'KSA' }
    await opsSame('validateTrackerRecord_', [t, bad], depFx, async () => validateTrackerRecord_(t, bad, await allOptions()))
  })
})
