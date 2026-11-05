/**
 * Golden-oracle tests for the Quality port: the legacy Quality_deprecated/
 * Quality.js + QaEngine.js run verbatim inside scripts/oracle.mjs against the
 * ported pure helpers in src/features/cx-quality/lib/{core,pure,analytics,engine}.ts.
 *
 * Picks scoring math, window/period choice, coverage partitioning and the
 * parse helpers — the rules the five ported pages are built on.
 */
import { describe, expect, it } from 'vitest'
import { createOracle } from '../../scripts/oracle.mjs'
import { diffPath, json } from './helpers-oracle'
import * as core from '../../src/features/cx-quality/lib/core'
import * as pure from '../../src/features/cx-quality/lib/pure'
import * as analytics from '../../src/features/cx-quality/lib/analytics'
import * as engine from '../../src/features/cx-quality/lib/engine'

/** Quality file list (shared LEGACY_FILES belongs to the productivity oracle). */
const FILES = [
  'Config.js',
  'Auth.js',
  'Repo.js',
  'Options.js',
  'PeopleCore.js',
  'WorkCalendar.js',
  'Stores.js',
  'Notify.js',
  'ViewAs.js',
  'QueueCore.js',
  'WorkCore.js',
  'ProdCore.js',
  'Quality.js',
  'QaEngine.js',
]

let _oracle: ReturnType<typeof createOracle> | null = null
function oracle() {
  if (!_oracle) _oracle = createOracle(FILES)
  return _oracle
}

/** callLegacy for the Quality oracle — { ok: value } / { err: message }. */
function callQa(fn: string, args: unknown[] = [], fixtures: unknown = {}) {
  try {
    return { ok: json(oracle().call(fn, args, fixtures as object)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

function callPort(fn: () => unknown) {
  try {
    return { ok: json(fn()) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

/** Same value, same field order, same error — on both sides. */
function sameQa(fn: string, args: unknown[], port: () => unknown, fixtures: unknown = {}) {
  const a = callQa(fn, args, fixtures)
  const b = callPort(port)
  const d = diffPath(a, b)
  return d
}

const NOW = Date.parse('2026-03-04T09:00:00Z')

/* ---- form fixtures shared by the scoring tests ------------------------- */

const SECS = [
  {
    title: 'Resolution',
    questions: [
      { id: 'q1', text: 'Resolved on first contact', weight: 60, fatal: false, hint: '' },
      { id: 'q2', text: 'Correct answer given', weight: 40, fatal: true, hint: '' },
    ],
  },
  {
    title: 'Tone',
    optional: true,
    questions: [{ id: 'q3', text: 'Tone matched the brand', weight: 10, fatal: false, hint: '' }],
  },
]
const FORM_W = {
  formId: 'F1',
  version: 2,
  title: 'Ticket form',
  scoring: 'weighted',
  sections: SECS,
}
const FORM_D = { ...FORM_W, formId: 'F2', scoring: 'deduction' }
const FORMS = {
  byKey: {
    'F1|2': FORM_W,
    'F2|2': FORM_D,
  },
}

describe('scoring & submission', () => {
  it('qaQuestions_ flattens sections with optional inherit', () => {
    expect(sameQa('qaQuestions_', [FORM_W], () => core.qaQuestions_(FORM_W as never))).toBeNull()
  })

  it('qaScore_ weighted: pass/fail/na mix', () => {
    const answers = { q1: 'pass', q2: 'fail', q3: 'na' }
    expect(sameQa('qaScore_', [FORM_W, answers], () => core.qaScore_(FORM_W as never, answers))).toBeNull()
  })

  it('qaScore_ deduction: fatal weight and deductions', () => {
    const answers = { q1: 'fail', q2: 'pass', q3: 'na' }
    expect(sameQa('qaScore_', [FORM_D, answers], () => core.qaScore_(FORM_D as never, answers))).toBeNull()
  })

  it('qaScore_ deduction: a 100% deduction zeroes the audit', () => {
    const form = { formId: 'F3', scoring: 'deduction', sections: [
      { title: 'S', questions: [
        { id: 'a', text: 'a', weight: 100, fatal: false },
        { id: 'b', text: 'b', weight: 30, fatal: false },
      ] },
    ] }
    const answers = { a: 'fail', b: 'pass' }
    expect(sameQa('qaScore_', [form, answers], () => core.qaScore_(form as never, answers))).toBeNull()
  })

  it('qaScoreSubmission_ validates + scores (clean pass)', () => {
    const answers = { q1: 'pass', q2: 'pass' }
    expect(sameQa('qaScoreSubmission_', [FORMS, 'F1', 2, answers], () =>
      pure.qaScoreSubmission_(FORMS as never, 'F1', 2, answers)
    )).toBeNull()
  })

  it('qaScoreSubmission_ throws on a critical N/A', () => {
    const answers = { q1: 'pass', q2: 'na' }
    expect(sameQa('qaScoreSubmission_', [FORMS, 'F1', 2, answers], () =>
      pure.qaScoreSubmission_(FORMS as never, 'F1', 2, answers)
    )).toBeNull()
  })

  it('qaScoreSubmission_ throws with questions left unanswered', () => {
    const answers = { q1: 'pass' }
    expect(sameQa('qaScoreSubmission_', [FORMS, 'F1', 2, answers], () =>
      pure.qaScoreSubmission_(FORMS as never, 'F1', 2, answers)
    )).toBeNull()
  })

  it('qaScoreSubmission_ throws on an unknown form version', () => {
    const answers = { q1: 'pass', q2: 'pass' }
    expect(sameQa('qaScoreSubmission_', [FORMS, 'F1', 9, answers], () =>
      pure.qaScoreSubmission_(FORMS as never, 'F1', 9, answers)
    )).toBeNull()
  })

  it('qaNaAllowed_ matrix: critical, optional, Call Control', () => {
    const cases: unknown[][] = [
      [FORM_W, { fatal: false, weight: 40, optional: false, section: 'Resolution' }],
      [FORM_W, { fatal: true, weight: 40, optional: false, section: 'Resolution' }],
      [FORM_W, { fatal: true, weight: 40, optional: true, section: 'Resolution' }],
      [FORM_W, { fatal: true, weight: 40, optional: false, section: 'Call Control' }],
      [FORM_D, { fatal: false, weight: 100, optional: false, section: 'S' }],
      [FORM_D, { fatal: false, weight: 100, optional: true, section: 'S' }],
      [FORM_D, { fatal: false, weight: 60, optional: false, section: 'S' }],
    ]
    for (const [def, q] of cases) {
      expect(
        sameQa('qaNaAllowed_', [def, q], () => pure.qaNaAllowed_(def as never, q as never)),
        JSON.stringify([(def as Record<string, unknown>).scoring, q])
      ).toBeNull()
    }
  })

  it('qaCleanFailReasons_ keeps tagged reasons, throws when missing', () => {
    expect(
      sameQa(
        'qaCleanFailReasons_',
        [{ q1: 'fail', q2: 'pass' }, { q1: 'kb', q2: 'agent' }],
        () => pure.qaCleanFailReasons_({ q1: 'fail', q2: 'pass' }, { q1: 'kb', q2: 'agent' })
      )
    ).toBeNull()
    expect(
      sameQa(
        'qaCleanFailReasons_',
        [{ q1: 'fail', q2: 'fail' }, { q1: 'kb' }],
        () => pure.qaCleanFailReasons_({ q1: 'fail', q2: 'fail' }, { q1: 'kb' })
      )
    ).toBeNull()
  })

  it('qaFinalScore_ honors re-score and dispute states', () => {
    const cases = [
      { score_final: 60, fatal: true },
      { score_final: '', score: 75, fatal: '' },
      { score_final: 0, rescored: true, score: 55 },
    ]
    for (const a of cases) {
      expect(sameQa('qaFinalScore_', [a], () => core.qaFinalScore_(a)), JSON.stringify(a)).toBeNull()
    }
  })

  it('qaAlignment_ weights the agreement with the reference', () => {
    const def = { scoring: 'weighted', sections: [
      { title: 'S', questions: [
        { id: 'a', text: 'a', weight: 60 },
        { id: 'b', text: 'b', weight: 40 },
      ] },
    ] }
    expect(
      sameQa(
        'qaAlignment_',
        [def, { a: 'pass', b: 'fail' }, { a: 'pass', b: 'pass' }],
        () => core.qaAlignment_(def as never, { a: 'pass', b: 'fail' } as never, { a: 'pass', b: 'pass' } as never)
      )
    ).toBeNull()
  })

  it('qaNeedsCtl_ + qaLostQuestions_ on a failed submission', () => {
    const answers = { q1: 'fail', q2: 'fail', q3: 'na' }
    const score = core.qaScore_(FORM_W as never, answers)
    expect(sameQa('qaNeedsCtl_', [FORM_W, answers, score], () =>
      core.qaNeedsCtl_(FORM_W as never, answers, score as never)
    )).toBeNull()
    expect(sameQa('qaLostQuestions_', [FORM_W, answers], () =>
      core.qaLostQuestions_(FORM_W as never, answers)
    )).toBeNull()
  })
})

describe('ranges & periods', () => {
  it('qaDaysBetween_ day math incl. leap boundary', () => {
    for (const [a, b] of [
      ['2026-03-01', '2026-03-04'],
      ['2024-02-28', '2024-03-01'],
      ['2026-01-01', '2026-01-01'],
    ]) {
      expect(sameQa('qaDaysBetween_', [a, b], () => pure.qaDaysBetween_(a, b)), `${a}->${b}`).toBeNull()
    }
  })

  it('qaRangeBucket_ at the bucket edges', () => {
    for (const d of [1, 31, 32, 120, 121, 366]) {
      expect(sameQa('qaRangeBucket_', [d], () => pure.qaRangeBucket_(d)), String(d)).toBeNull()
    }
  })

  it('qaCheckRange_ accepts and rejects identically', () => {
    const cases = [
      ['2026-03-01', '2026-03-04'],
      ['2026-03-04', '2026-03-01'],
      ['2026-02-30', '2026-03-01'],
      ['2025-01-01', '2026-02-01'],
    ]
    for (const [a, b] of cases) {
      expect(sameQa('qaCheckRange_', [a, b], () => pure.qaCheckRange_(a, b)), `${a}->${b}`).toBeNull()
    }
  })

  it('qaPeriodOf_ week/month anchors', () => {
    for (const [d, g, s] of [
      ['2026-03-04', 'week', 0],
      ['2026-03-04', 'week', 1],
      ['2026-03-04', 'month', 0],
    ] as const) {
      expect(sameQa('qaPeriodOf_', [d, g, s], () => core.qaPeriodOf_(d, g, s)), `${d} ${g} ${s}`).toBeNull()
    }
  })

  it('qaPeriods_ the offered periods, newest first', () => {
    for (const [g, today, s] of [
      ['week', '2026-03-04', 0],
      ['week', '2026-03-04', 1],
      ['month', '2026-03-04', 0],
    ] as const) {
      expect(sameQa('qaPeriods_', [g, today, s], () => pure.qaPeriods_(g, today, s)), `${g} ${s}`).toBeNull()
    }
  })

  it('qaPrevPeriod_/qaPeriodStart_/qaPeriodEnd_ window edges', () => {
    for (const g of ['week', 'month'] as const) {
      const p = g === 'week' ? '2026-02-22' : '2026-02'
      expect(sameQa('qaPrevPeriod_', [p, g], () => analytics.qaPrevPeriod_(p, g)), `${g} prev`).toBeNull()
      expect(sameQa('qaPeriodStart_', [p, g], () => analytics.qaPeriodStart_(p, g)), `${g} start`).toBeNull()
      expect(sameQa('qaPeriodEnd_', [p, g], () => analytics.qaPeriodEnd_(p, g)), `${g} end`).toBeNull()
    }
  })
})

describe('parse & clean helpers', () => {
  it('qaParse_ json with fallback', () => {
    for (const [s, f] of [
      ['{"a":1}', null],
      ['not json', 'FB'],
      ['', []],
    ] as const) {
      expect(sameQa('qaParse_', [s, f], () => core.qaParse_(s, f)), s).toBeNull()
    }
  })

  it('qaSquash_ collapses whitespace', () => {
    expect(sameQa('qaSquash_', ['  a  b\n c '], () => pure.qaSquash_('  a  b\n c '))).toBeNull()
    expect(sameQa('qaSquash_', [null], () => pure.qaSquash_(null))).toBeNull()
  })

  it('qaCleanReason_/qaCleanPassReason_ length rules', () => {
    const inputs = ['ok', 'say more now', '  spaced   out  ', 'x'.repeat(501)]
    for (const r of inputs) {
      expect(sameQa('qaCleanReason_', [r, 'requesting'], () => pure.qaCleanReason_(r, 'requesting')), r.slice(0, 20)).toBeNull()
      expect(sameQa('qaCleanPassReason_', [r], () => pure.qaCleanPassReason_(r)), r.slice(0, 20)).toBeNull()
    }
  })

  it('qaEmailList_ splits the recipient list', () => {
    for (const v of ['a@x.com', 'a@x.com, b@y.com ; c@z.com', ['a@x.com', 'b@y.com'], '']) {
      expect(sameQa('qaEmailList_', [v], () => core.qaEmailList_(v)), JSON.stringify(v)).toBeNull()
    }
  })

  it('qaKbItem_ prefixes only numeric ids', () => {
    for (const g of [{ ticket_id: '12345' }, { ticket_id: 'Cash refund: 1' }, { ticket_id: '' }]) {
      expect(sameQa('qaKbItem_', [g, '#'], () => pure.qaKbItem_(g, '#')), JSON.stringify(g)).toBeNull()
    }
  })

  it('qaNonTicketClash_ finds the same type+reference row', () => {
    const rows = [
      { audit_type: 'Cash refund', reference: 'T-1', status: 'open' },
      { audit_type: 'cash  refund', reference: 't-1', status: 'done' },
      { audit_type: 'Cash refund', reference: 'T-2', status: 'waived' },
      { audit_type: '', reference: '', status: 'open' },
    ]
    for (const [t, r] of [
      ['Cash refund', 'T-1'],
      ['cash refund', 't-1'],
      ['Cash refund', 'T-2'],
      ['nope', 'x'],
    ]) {
      expect(sameQa('qaNonTicketClash_', [rows, t, r], () => pure.qaNonTicketClash_(rows, t, r)), `${t} ${r}`).toBeNull()
    }
  })

  it('qaTimesAsText_/qaTextTime_ the engine Riyadh apostrophe times', () => {
    const row = { interaction_at: '2026-03-01 10:30', action_at: "'2026-03-01 11:00" }
    expect(sameQa('qaTimesAsText_', [row], () => pure.qaTimesAsText_({ ...row }))).toBeNull()
    for (const v of ['2026-03-01 10:30', '', null]) {
      expect(sameQa('qaTextTime_', [v], () => pure.qaTextTime_(v)), JSON.stringify(v)).toBeNull()
    }
  })

  it('qaCleanInteractionAt_ validation incl. future and 180-day bounds', () => {
    const cases = [
      '2026-03-04 08:30',
      '2026-03-04T08:30',
      '2026-03-04 12:00',
      '2025-09-01 10:00',
      'not a date',
      '',
    ]
    for (const v of cases) {
      expect(
        sameQa('qaCleanInteractionAt_', [v, NOW], () => pure.qaCleanInteractionAt_(v, NOW)),
        v
      ).toBeNull()
    }
  })

  it('qaQueueFields_ copies engine fields only', () => {
    const row = { keep: 'me' }
    const f = { channel: 'chat', contact_type: 'refund', extra: 'dropped' }
    expect(sameQa('qaQueueFields_', [{ ...row }, f], () => pure.qaQueueFields_({ ...row }, f))).toBeNull()
  })

  it('qaTakenByOther_ role + started + owner matrix', () => {
    const cases = [
      [{ started_at: 'x', status: 'in_progress', auditor_email: 'a@x.com' }, { email: 'b@x.com', role: 'agent' }],
      [{ started_at: 'x', status: 'in_progress', auditor_email: 'a@x.com' }, { email: 'b@x.com', role: 'admin' }],
      [{ started_at: 'x', status: 'done', auditor_email: 'a@x.com' }, { email: 'b@x.com', role: 'agent' }],
      [{ started_at: '', status: 'open', auditor_email: 'a@x.com' }, { email: 'b@x.com', role: 'agent' }],
      [{ started_at: 'x', status: 'in_progress', auditor_email: 'a@x.com' }, { email: 'a@x.com', role: 'agent' }],
    ]
    for (const [q, u] of cases) {
      expect(sameQa('qaTakenByOther_', [q, u], () => pure.qaTakenByOther_(q, u as never)), JSON.stringify([q.status, u.role])).toBeNull()
    }
  })

  it('qaAuditorVia_ why a roster person can audit', () => {
    const cases: [Record<string, unknown>, string[], string[]][] = [
      [{ email: 'a@x.com', role: 'agent', position: 'senior auditor' }, ['auditor'], ['a@x.com']],
      [{ email: 'a@x.com', role: 'tl', position: 'tl' }, ['auditor'], []],
      [{ email: 'a@x.com', role: 'agent', position: 'support' }, ['auditor'], ['a@x.com']],
      [{ email: 'a@x.com', role: 'agent', position: 'QA auditor' }, ['auditor'], []],
      [{ email: 'a@x.com', role: 'agent', position: 'support' }, ['auditor'], []],
    ]
    for (const [p, k, g] of cases) {
      expect(sameQa('qaAuditorVia_', [p, k, g], () => pure.qaAuditorVia_(p as never, k, g)), JSON.stringify([p.role, g.length])).toBeNull()
    }
  })

  it('qaIsNonTicket_/qaItemId_/qaItemRef_/qaItemTag_ naming', () => {
    for (const r of [
      { audit_type: 'Cash refund', reference: 'R-1', ticket_id: '' },
      { audit_type: '', reference: '', ticket_id: '991' },
    ]) {
      expect(sameQa('qaIsNonTicket_', [r], () => core.qaIsNonTicket_(r))).toBeNull()
      expect(sameQa('qaItemId_', [r], () => core.qaItemId_(r))).toBeNull()
      expect(sameQa('qaItemRef_', [r], () => core.qaItemRef_(r))).toBeNull()
      expect(sameQa('qaItemTag_', [r], () => core.qaItemTag_(r))).toBeNull()
    }
  })

  it('qaWhen_ normalizes date-ish values', () => {
    for (const v of ['2026-03-01 10:30', '2026-03-01', '', null]) {
      expect(sameQa('qaWhen_', [v], () => core.qaWhen_(v)), JSON.stringify(v)).toBeNull()
    }
  })

  it('qaBool_/qaRound1_ primitives', () => {
    for (const v of [true, 'TRUE', 'false', '', null, 1]) {
      expect(sameQa('qaBool_', [v], () => core.qaBool_(v)), JSON.stringify(v)).toBeNull()
    }
    for (const x of [0.04, 0.05, 12.349999]) {
      expect(sameQa('qaRound1_', [x], () => core.qaRound1_(x)), String(x)).toBeNull()
    }
  })

  it('qaNameKey_ accents/casing/arabic', () => {
    for (const s of ['Abd-El Samad', 'José  García', 'محمد علي', 'a  b']) {
      expect(sameQa('qaNameKey_', [s], () => core.qaNameKey_(s)), s).toBeNull()
    }
  })

  it('qaDisputeMonth_/qaIsSettled_ month assignment', () => {
    for (const d of [
      { decided_at: '2026-02-10 09:00', raised_date: '2026-01-31' },
      { decided_at: '', raised_date: '2026-02-01' },
    ]) {
      expect(sameQa('qaDisputeMonth_', [d], () => core.qaDisputeMonth_(d)), JSON.stringify(d)).toBeNull()
    }
    for (const a of [{ status: 'done' }, { status: 'open' }, { status: 'rescored' }]) {
      expect(sameQa('qaIsSettled_', [a], () => core.qaIsSettled_(a)), JSON.stringify(a)).toBeNull()
    }
  })

  it('qaCleanForm_ form payload sanitation', () => {
    const input = {
      title: '  Form  ',
      channel: 'chat',
      scoring: 'deduction',
      sections: [
        { title: ' S ', optional: true, questions: [{ text: ' q ', weight: '30', fatal: 'true', hint: ' h ' }] },
      ],
    }
    expect(sameQa('qaCleanForm_', [input], () => core.qaCleanForm_(input))).toBeNull()
  })

  it('qaAuditHasMarkdown_ markdown detection', () => {
    const forms = { byKey: { 'F1|2': FORM_W } }
    for (const a of [
      { form_id: 'F1', form_version: 2, answers: { q1: 'fail', q2: 'pass' }, markdown_note: 'x' },
      { form_id: 'F1', form_version: 2, answers: { q1: 'pass', q2: 'pass' }, markdown_note: '' },
    ]) {
      expect(sameQa('qaAuditHasMarkdown_', [a, forms], () => core.qaAuditHasMarkdown_(a as never, forms as never)), JSON.stringify(a.markdown_note)).toBeNull()
    }
  })
})

describe('statistics & analytics helpers', () => {
  it('qaWilson_ interval math', () => {
    for (const [k, n] of [[8, 10], [0, 10], [15, 16], [3, 4]]) {
      expect(sameQa('qaWilson_', [k, n], () => analytics.qaWilson_(k, n)), `${k}/${n}`).toBeNull()
    }
  })

  it('qaFlatMargin_ + qaConfidenceBadge_ verdict gating', () => {
    for (const n of [4, 10, 16, 40]) {
      expect(sameQa('qaFlatMargin_', [n], () => analytics.qaFlatMargin_(n)), String(n)).toBeNull()
    }
    for (const [n, m] of [[4, 2], [16, 4], [10, 6], [40, 3]]) {
      expect(sameQa('qaConfidenceBadge_', [n, m], () => analytics.qaConfidenceBadge_(n, m)), `${n} ${m}`).toBeNull()
    }
  })

  it('qaMeanCi_ + qaAgentMeanCi_ the per-agent CI', () => {
    const cases: [number[], number][] = [
      [[90, 80, 100], 4],
      [[100], 16],
      [[85, 85, 85, 85], 16],
      [[], 10],
    ]
    for (const [scores, N] of cases) {
      expect(sameQa('qaMeanCi_', [scores, N], () => analytics.qaMeanCi_(scores, N)), JSON.stringify(scores)).toBeNull()
    }
    const items = [
      { agent: 'a@x.com', score: 90 },
      { agent: 'a@x.com', score: 70 },
      { agent: 'b@x.com', score: 80 },
    ]
    expect(sameQa('qaAgentMeanCi_', [items, 2], () => analytics.qaAgentMeanCi_(items as never, 2))).toBeNull()
    expect(sameQa('qaAgentMeanCi_', [items], () => analytics.qaAgentMeanCi_(items as never))).toBeNull()
  })

  it('qaTrend_ beyond-both-ranges arrow', () => {
    const cases = [
      [{ mean: 95, margin: 3 }, { mean: 80, margin: 4 }],
      [{ mean: 82, margin: 3 }, { mean: 80, margin: 4 }],
      [{ mean: 90, margin: null }, { mean: 80, margin: 4 }],
      [null, { mean: 80, margin: 4 }],
    ]
    for (const [cur, prev] of cases) {
      expect(sameQa('qaTrend_', [cur, prev], () => analytics.qaTrend_(cur as never, prev as never)), JSON.stringify([cur, prev])).toBeNull()
    }
  })

  it('qaScoreDate_/qaHasInteraction_ basis dates', () => {
    const a = { interaction_at: '2026-03-01 10:00', audit_date: '2026-03-02' }
    for (const basis of ['interaction', 'audit']) {
      expect(sameQa('qaScoreDate_', [a, basis], () => analytics.qaScoreDate_(a, basis)), basis).toBeNull()
    }
    expect(sameQa('qaHasInteraction_', [a], () => analytics.qaHasInteraction_(a))).toBeNull()
    expect(sameQa('qaHasInteraction_', [{ interaction_at: '' }], () => analytics.qaHasInteraction_({ interaction_at: '' }))).toBeNull()
  })

  it('qaDeriveBasis_/qaSampleBasis_ basis derivation', () => {
    const cases = [
      { sample_basis: 'random' },
      { sample_basis: '', source: 'request' },
      { sample_basis: '', source: 'offqueue' },
      { audit_type: 'Cash refund' },
      { kind: 'historical' },
      {},
    ]
    for (const a of cases) {
      expect(sameQa('qaDeriveBasis_', [a], () => analytics.qaDeriveBasis_(a)), JSON.stringify(a)).toBeNull()
      expect(sameQa('qaSampleBasis_', [a], () => analytics.qaSampleBasis_(a)), JSON.stringify(a)).toBeNull()
    }
  })

  it('qaScoreKnown_/qaIsCritical_ row rules', () => {
    for (const a of [
      { score_final: 60 },
      { score_final: '', score: 70 },
      { score_final: '', score: '' },
      { fatal: true, status: 'open' },
      { fatal: true, status: 'rescored' },
      { fatal: '', status: 'open' },
    ]) {
      expect(sameQa('qaScoreKnown_', [a], () => analytics.qaScoreKnown_(a)), JSON.stringify(a)).toBeNull()
      expect(sameQa('qaIsCritical_', [a], () => analytics.qaIsCritical_(a)), JSON.stringify(a)).toBeNull()
    }
  })

  it('qaGateSort_ gated-then-sorted rows', () => {
    const rows = [
      { audits: 20, avg: 90, key: 'a' },
      { audits: 5, avg: 50, key: 'b' },
      { audits: 30, avg: 70, key: 'c' },
      { audits: 5, avg: 95, key: 'd' },
    ]
    expect(sameQa('qaGateSort_', [rows, 10], () => analytics.qaGateSort_(rows as never, 10))).toBeNull()
  })

  it('qaPointsLost_ per-100 loss per question', () => {
    const cases: [Record<string, unknown>, Record<string, unknown>, number][] = [
      [{ scoring: 'weighted' }, { fatal: false, weight: 40 }, 100],
      [{ scoring: 'weighted' }, { fatal: true, weight: 40 }, 100],
      [{ scoring: 'deduction' }, { fatal: false, weight: 25 }, 200],
    ]
    for (const [def, q, p] of cases) {
      expect(sameQa('qaPointsLost_', [def, q, p], () => analytics.qaPointsLost_(def as never, q as never, p)), JSON.stringify([q, p])).toBeNull()
    }
  })

  it('qaReasonCounts_ the empty accumulator', () => {
    expect(sameQa('qaReasonCounts_', [], () => analytics.qaReasonCounts_())).toBeNull()
  })

  it('qaPostStratify_ re-weights to ticket volumes', () => {
    const cases = [
      [{ refund: [90, 80], other: [60] }, { refund: 10, other: 5 }],
      [{ refund: [90] }, {}],
      [{}, { refund: 10 }],
    ]
    for (const [s, v] of cases) {
      expect(sameQa('qaPostStratify_', [s, v], () => analytics.qaPostStratify_(s as never, v as never)), JSON.stringify([s, v])).toBeNull()
    }
  })

  it('qaVolumeRows_/qaVolumeFor_ ticket volumes per period', () => {
    const pool = [
      { day: '2026-02-22', channel: 'chat', contactType: 'refund' },
      { day: '2026-02-22', channel: 'chat', contactType: 'other' },
      { day: '2026-03-01', channel: 'email', contactType: 'refund' },
    ]
    const nowIso = '2026-03-04T00:00:00Z'
    const rows = analytics.qaVolumeRows_(pool, nowIso)
    expect(sameQa('qaVolumeRows_', [pool, nowIso], () => analytics.qaVolumeRows_(pool, nowIso))).toBeNull()
    for (const [g, p, s] of [
      ['week', '2026-02-22', 0],
      ['month', '2026-02', 0],
    ] as const) {
      expect(sameQa('qaVolumeFor_', [rows, g, p, s], () => analytics.qaVolumeFor_(rows, g, p, s)), `${g} ${p}`).toBeNull()
    }
  })
})

describe('partitioning & rollups', () => {
  const AUDITS = [
    { audit_id: 'A1', agent_email: 'A@x.com', auditor_email: 'TL@x.com', audit_date: '2026-03-01', score: 90, fatal: '', status: 'done', kind: '', source: 'random' },
    { audit_id: 'A2', agent_email: 'a@x.com', auditor_email: 'tl@x.com', audit_date: '2026-03-02', score: 70, fatal: '', status: 'done', kind: '', source: 'request' },
    { audit_id: 'A3', agent_email: 'b@x.com', auditor_email: 'tl@x.com', audit_date: '2026-02-10', score: 80, fatal: true, status: 'done', kind: '', source: 'random' },
    { audit_id: 'A4', agent_email: 'a@x.com', auditor_email: 'tl@x.com', audit_date: '2026-03-03', score: 85, fatal: '', status: 'done', kind: 'calibration', source: 'random' },
  ]
  const DISPUTES = [
    { audit_id: 'A2', status: 'open', raised_date: '2026-03-02', decided_at: '' },
    { audit_id: 'A3', status: 'upheld', raised_date: '2026-02-11', decided_at: '2026-02-12 09:00' },
  ]
  const CTLS = [
    { audit_id: 'A1', tl_email: 'tl@x.com', due_date: '2026-03-05', submitted_date: '2026-03-04', status: 'acknowledged' },
    { audit_id: 'A3', tl_email: 'tl@x.com', due_date: '2026-02-13', submitted_date: '', status: 'open' },
  ]

  it('qaRollupAudits_ settled/current partitioning', () => {
    expect(sameQa('qaRollupAudits_', [AUDITS], () => core.qaRollupAudits_(AUDITS))).toBeNull()
  })

  it('qaDisputeStats_ month rollup', () => {
    for (const m of ['2026-02', '2026-03']) {
      expect(sameQa('qaDisputeStats_', [AUDITS, DISPUTES, m], () => core.qaDisputeStats_(AUDITS, DISPUTES, m)), m).toBeNull()
    }
  })

  it('qaCtlSla_ the CTL SLA rollup', () => {
    for (const m of ['2026-02', '2026-03']) {
      expect(sameQa('qaCtlSla_', [CTLS, m, '2026-03-04'], () => core.qaCtlSla_(CTLS, m, '2026-03-04')), m).toBeNull()
    }
  })

  it('qaAuditorKpis_ the auditor-month KPIs', () => {
    const cals = [{ status: 'done', alignment: 75, month: '2026-03' }]
    const kb = [{ sameDay: true, created_date: '2026-03-02' }]
    for (const m of ['2026-02', '2026-03']) {
      expect(
        sameQa('qaAuditorKpis_', [AUDITS, DISPUTES, cals, kb, m], () =>
          core.qaAuditorKpis_(AUDITS, DISPUTES, cals as never, kb as never, m)
        ),
        m
      ).toBeNull()
    }
  })

  it('qaMyAuditCounts_ own-week/month counts (calibration excluded)', () => {
    expect(
      sameQa('qaMyAuditCounts_', [AUDITS, 'a@x.com', '2026-03-01', '2026-03-04'], () =>
        pure.qaMyAuditCounts_(AUDITS, 'a@x.com', '2026-03-01', '2026-03-04')
      )
    ).toBeNull()
    expect(
      sameQa('qaMyAuditCounts_', [AUDITS, 'tl@x.com', '2026-03-01', '2026-03-04'], () =>
        pure.qaMyAuditCounts_(AUDITS, 'tl@x.com', '2026-03-01', '2026-03-04')
      )
    ).toBeNull()
  })

  it('qeQuotaFor_ action-plan + offer multiplier quota', () => {
    const S = {
      auditsPerDay: 2,
      auditsPerWeek: 8,
      offerMultiplier: 2,
      actionPlan: { agents: ['Agent A'], perDay: 4, perWeek: 16 },
    }
    for (const name of ['Agent A', 'Agent B']) {
      expect(
        sameQa('qeQuotaFor_', [name, S], () => engine.qeQuotaFor_(name, S)),
        name
      ).toBeNull()
    }
  })

  it('qaFindOpenCtls_ CTL visibility partitioning', () => {
    const auditsBy = { 'a@x.com': AUDITS[0] }
    const ctls = CTLS.concat([
      { audit_id: 'A4', tl_email: 'other@x.com', due_date: '2026-03-06', submitted_date: '', status: 'open' } as never,
    ])
    const user = { email: 'tl@x.com', role: 'tl' }
    expect(
      sameQa('qaFindOpenCtls_', [ctls, auditsBy, 'a@x.com', user, ['tl@x.com']], () =>
        core.qaFindOpenCtls_(ctls as never, auditsBy as never, 'a@x.com', user, ['tl@x.com'])
      )
    ).toBeNull()
  })
})

describe('coverage & queue-reason', () => {
  it('qaQueuedReason_ reason text matrix', () => {
    const cases: unknown[][] = [
      [null, null, true, '2026-02-01', '2026-02-15'],
      [null, { lb: 7 }, false, '', '2026-02-15'],
      [null, { lb: 7 }, true, '2026-02-20', '2026-02-15'],
      [null, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'none', t: 0, d: {}, p: 0, f: 0 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'min', t: 3, d: { spam: 2 }, p: 1, f: 1 }, { lb: 7, min: 2 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'cf', t: 5, d: {}, p: 0, f: 2 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'week', t: 4, d: {}, p: 0, f: 0, w: 9, c: 9 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'capped', t: 4, d: {}, p: 0, f: 0, s: 1, w: 3, c: 4 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'today', t: 2, d: {}, p: 0, f: 0, y: 3 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'pool', t: 4, d: {}, p: 0, f: 1, k: 2, s: 4 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'channel', t: 4, d: {}, p: 0, f: 1, k: 2, s: 4 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'other', k: 2, y: 1 }, { lb: 7 }, true, '2026-02-01', '2026-02-15'],
      [{ r: 'x', k: 0 }, { lb: 7 }, null, '', '2026-02-15'],
    ]
    for (const [o, day, built, firstRec, date] of cases) {
      expect(
        sameQa('qaQueuedReason_', [o, day, built, firstRec, date], () =>
          pure.qaQueuedReason_(o as never, day as never, built as never, firstRec as never, date as never)
        ),
        JSON.stringify([(o as Record<string, unknown>)?.r, built])
      ).toBeNull()
    }
  })

  it('qaCoverage_ per-agent-per-day partition over the Queue Log', () => {
    const days = 14
    const todayKey = '2026-03-04'
    const people = [
      { email: 'a@x.com', name: 'Agent A', role: 'agent', tlEmail: 'tl@x.com' },
      { email: 'b@x.com', name: 'Agent B', role: 'agent', tlEmail: 'tl@x.com' },
      { email: 'tl@x.com', name: 'Lead T', role: 'tl', tlEmail: '' },
    ]
    const headcount = [{ email: 'a@x.com', fdId: 'FD1', fdName: 'Agent Alpha' }]
    const S = { excludeAgents: [] }
    const header = ['Agent', 'State', 'Queued Date', 'Audited At', 'Agent Email', 'Agent FD ID']
    const values = [
      header,
      ['Agent A', 'audited', '2026-03-01', '2026-03-02', 'a@x.com', 'FD1'],
      ['Agent A', 'pending', '2026-03-03', '', 'a@x.com', 'FD1'],
      ['Agent Alpha', 'passed', '2026-03-01', '', 'a@x.com', 'FD1'],
      ['Agent B', 'expired', '2026-02-28', '', 'b@x.com', ''],
      ['Not Roster', 'pending', '2026-03-04', '', '', ''],
    ]
    const hist = {
      outcomes: [
        {
          date: '2026-03-03',
          ranAt: '2026-03-03T06:00:00Z',
          outcomes: { a: { 'Agent B': { e: 'b@x.com', i: '', r: 'none', t: 0, d: {}, p: 0, f: 0 } } },
        },
      ],
      builds: { '2026-03-03': true },
    }
    const legacy = callQa('qaCoverage_', [values, people, headcount, S, todayKey, days, hist])
    const port = callPort(() =>
      pure.qaCoverage_(values as never, people as never, headcount as never, S as never, todayKey, days, hist as never)
    )
    const d = diffPath(legacy, port)
    expect(d).toBeNull()
  })

  it('qaCoverage_ errors on a headerless sheet', () => {
    const values = [['junk'], ['no headers here']]
    const legacy = callQa('qaCoverage_', [values, [], [], {}, '2026-03-04', 7, null])
    const port = callPort(() =>
      pure.qaCoverage_(values as never, [], [], {}, '2026-03-04', 7, null)
    )
    expect(diffPath(legacy, port)).toBeNull()
  })
})

describe('queue parse & dir seams', () => {
  it('qaQueueFromSheet_ the Queue Log parse', () => {
    const ctx = {
      today: '2026-03-04',
      auditors: ['tl@x.com', 'tl2@x.com'],
      people: [
        { email: 'a@x.com', name: 'Agent A', role: 'agent', tlEmail: 'tl@x.com' },
        { email: 'b@x.com', name: 'Agent B', role: 'agent', tlEmail: 'tl@x.com' },
      ],
      headcount: [],
      map: {},
    }
    const values = [
      ['Ticket ID', 'Agent', 'Queued Date', 'Audited At', 'Agent Email', 'Agent FD ID', 'Channel', 'Contact Type', 'State', 'Key', 'Status', 'Auditor'],
      ['991', 'Agent A', '2026-03-03', '', 'a@x.com', '', 'chat', 'refund', 'pending', 'K1', 'open', ''],
      ['992', 'Agent B', '2026-03-03', '2026-03-03', 'b@x.com', '', 'email', 'other', 'audited', 'K2', 'done', 'tl@x.com'],
      ['993', 'Agent A', '2026-03-04', '', 'a@x.com', '', 'chat', 'other', 'pending', 'K3', 'open', 'tl2@x.com'],
      ['', 'Ghost', '2026-03-04', '', '', '', 'chat', 'x', 'pending', '', '', ''],
    ]
    const legacy = callQa('qaQueueFromSheet_', [values, ctx])
    const port = callPort(() =>
      core.qaQueueFromSheet_(values as never, ctx as never, (d: Date) =>
        engine.qeFmt_(d, 'yyyy-MM-dd HH:mm')
      )
    )
    expect(diffPath(legacy, port)).toBeNull()
  })

  it('qaQueueFromSheet_ errors on a headerless sheet', () => {
    const ctx = { today: '2026-03-04', auditors: [], people: [], headcount: [], map: {} }
    const values = [['junk']]
    const legacy = callQa('qaQueueFromSheet_', [values, ctx])
    const port = callPort(() => core.qaQueueFromSheet_(values as never, ctx as never))
    expect(diffPath(legacy, port)).toBeNull()
  })

  it('qaRequestRows_ request partition + dir names', () => {
    const all = [
      { queue_id: 'Q1', source: 'request', status: 'open', queue_date: '2026-03-01', ticket_id: '1', agent_email: 'a@x.com', agent_name: '', tl_email: 'tl@x.com', channel: 'chat', contact_type: '', ticket_status: '', started_at: '', audit_id: '', auditor_email: '', requested_by: 'me@x.com', requested_at: '2026-03-01 09:00', request_reason: 'see it', waived_by: '', waived_at: '', waive_reason: '' },
      { queue_id: 'Q2', source: 'request', status: 'waived', queue_date: '2026-02-20', ticket_id: '2', agent_email: 'b@x.com', agent_name: 'Bee', tl_email: '', channel: 'chat', contact_type: '', ticket_status: '', started_at: '', audit_id: '', auditor_email: '', requested_by: 'me@x.com', requested_at: '2026-02-20 09:00', request_reason: 'see it', waived_by: 'tl@x.com', waived_at: '2026-02-21', waive_reason: 'dup' },
      { queue_id: 'Q3', source: 'random', status: 'open', queue_date: '2026-03-02', ticket_id: '3', agent_email: 'a@x.com' },
    ]
    const dir = { name: '@@fn:__fn_dir_name__' } as never
    const user = { email: 'tl@x.com', role: 'tl' }
    const legacy = callQa('qaRequestRows_', [all, dir, user, '2026-02-15'])
    const port = callPort(() =>
      pure.qaRequestRows_(all as never, { name: (e: unknown) => 'Name ' + e } as never, user, '2026-02-15')
    )
    expect(diffPath(legacy, port)).toBeNull()
  })

  it('qaAuditMail_ the result email', () => {
    const a = {
      audit_id: 'A1', agent_email: 'a@x.com', tl_email: 'tl@x.com',
      audit_type: '', reference: '', ticket_id: '991', channel: 'chat',
      audit_date: '2026-03-02', score: 60, fatal: false,
    }
    const ctl = { due_date: '2026-03-05', tl_email: 'tl@x.com' }
    const dir = { name: '@@fn:__fn_dir_name__' } as never
    for (const enabled of [true, false]) {
      const legacy = callQa('qaAuditMail_', [a, ['Resolved on first contact'], 'do better', 'Lead T', ctl, dir, enabled])
      const port = callPort(() =>
        pure.qaAuditMail_(a as never, ['Resolved on first contact'], 'do better', 'Lead T', ctl as never, { name: (e: unknown) => 'Name ' + e } as never, enabled)
      )
      expect(diffPath(legacy, port), `enabled=${enabled}`).toBeNull()
    }
  })

  it('qaCtlPopup_/qaCtlPopups_ the CTL notifications', () => {
    const c = { tl_email: 'tl@x.com', ctl_id: 'CTL1', due_date: '2026-03-06' }
    const dir = { name: '@@fn:__fn_dir_name__' } as never
    const legacy = callQa('qaCtlPopup_', [c, 'Agent A', 'ticket #991'])
    const port = callPort(() => pure.qaCtlPopup_(c as never, 'Agent A', 'ticket #991'))
    expect(diffPath(legacy, port)).toBeNull()
    const legacy2 = callQa('qaCtlPopups_', [c, 'Agent A', 'ticket #991', dir, ['tl@x.com', 'shift@x.com']])
    const port2 = callPort(() =>
      pure.qaCtlPopups_(c as never, 'Agent A', 'ticket #991', { name: (e: unknown) => 'Name ' + e } as never, ['tl@x.com', 'shift@x.com'])
    )
    expect(diffPath(legacy2, port2)).toBeNull()
  })
})
