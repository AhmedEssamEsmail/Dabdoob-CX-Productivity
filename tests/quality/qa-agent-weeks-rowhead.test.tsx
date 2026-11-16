import { describe, expect, it, vi } from 'vitest'
import { AgentWeeks } from '@/features/cx-quality/components/quality-analytics-page'

/* Descriptor-tree regression test for specs/qa-agent-week-grid ux-1
   (WCAG 1.3.1): each Agents-by-week body row's agent-name cell must be a
   real row header <th scope="row" className="qa-cov__name">, matching the
   codebase's scrolling-grid pattern. AgentWeeks uses no hooks, so it is
   invoked directly and the returned element descriptors are walked
   recursively (arrays allowed). The page's imported component modules
   are stubbed so only the raw table markup is inspected. */

vi.mock('react/jsx-runtime', () => {
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key })
  return { jsx, jsxs: jsx, Fragment: 'fragment' }
})
vi.mock('react/jsx-dev-runtime', () => {
  const jsx = (type: unknown, props: unknown, key?: unknown) => ({ type, props, key })
  return { jsxDEV: jsx, Fragment: 'fragment' }
})

const stubComp = vi.hoisted(() => (name: string) => (props: Record<string, unknown>) => ({
  type: name,
  props,
}))

vi.mock('@/features/cx-quality/components/qa-shared', () => ({
  Chip: stubComp('Chip'),
  Count: stubComp('Count'),
  P: stubComp('P'),
  QA_BASIS_LABELS: {},
  QA_CONF: {},
  QA_CONF_TONE: {},
  QA_FLAG_LABELS: {},
  QA_REASON_LABELS: {},
  QA_TREND_ARROW: {},
  QaLink: stubComp('QaLink'),
  QaPage: stubComp('QaPage'),
  QaSection: stubComp('QaSection'),
  ScoreChip: stubComp('ScoreChip'),
  qaBand: () => 'ok',
  qaBasisNote: () => '',
  qaCi: () => '',
  qaMargin: () => '',
  qaPct: (n: number) => `${n}%`,
  qaPeriodLabel: () => '',
  qaReasonMix: () => [],
  qaVerdictTone: () => 'ok',
  useSe: () => ({}),
}))

vi.mock('@/features/cx-quality/components/quality-analytics-charts', () => ({
  Columns: stubComp('Columns'),
  Coverage: stubComp('Coverage'),
  SparkChart: stubComp('SparkChart'),
  Spread: stubComp('Spread'),
}))

vi.mock('@/features/shared/components/shell/ui', () => ({
  LoadError: stubComp('LoadError'),
}))

vi.mock('@/features/shared/components/ui', () => ({
  Button: stubComp('Button'),
  Seg: stubComp('Seg'),
  Select: stubComp('Select'),
  TableScroll: stubComp('TableScroll'),
}))

type El = {
  type: unknown
  props: Record<string, unknown> & { children?: unknown }
}

function* walk(node: unknown): Generator<El> {
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n)
    return
  }
  if (!node || typeof node !== 'object') return
  const el = node as El
  if ('type' in el && 'props' in el) yield el
  const kids = (el.props ?? {}).children
  if (kids && kids !== node) yield* walk(kids)
}

function bodyRows(root: El): El[] {
  const tbody = [...walk(root)].find((e) => e.type === 'tbody')
  if (!tbody) throw new Error('no tbody found')
  return (Array.isArray(tbody.props.children) ? tbody.props.children : [tbody.props.children])
    .filter((c): c is El => !!c && typeof c === 'object' && (c as El).type === 'tr')
}

const PERIODS = Array.from({ length: 12 }, (_, i) => `2025-01-${String(6 + i * 7).padStart(2, '0')}`)

function data(agents: unknown[]) {
  return {
    columns: {
      agentWeeks: {
        periods: PERIODS,
        agents,
      },
    },
    weekStartsOn: 0,
  }
}

const AGENT = {
  key: 'a',
  label: 'Ann',
  cells: PERIODS.map(() => ({ avg: 80, audits: 3, history: null })),
}

describe('AgentWeeks row headers (ux-1)', () => {
  it('renders the agent-name cell as <th scope="row" className="qa-cov__name">', () => {
    const root = AgentWeeks({ d: data([AGENT]) }) as unknown as El
    const rows = bodyRows(root)
    expect(rows).toHaveLength(1)
    const cells = [...walk(rows[0])].filter(
      (e) => e.type === 'th' || e.type === 'td'
    )
    // first cell is the row header; then 12 score cells
    expect(cells).toHaveLength(13)
    const [nameCell, ...scoreCells] = cells
    expect(nameCell.type).toBe('th')
    expect(nameCell.props.scope).toBe('row')
    expect(nameCell.props.className).toBe('qa-cov__name')
    expect(String(nameCell.props.children)).toContain('Ann')
    for (const c of scoreCells) {
      expect(c.type).toBe('td')
      expect(c.props.className).toBe('cx-num')
    }
  })

  it('keeps thead headers as scope="col"', () => {
    const root = AgentWeeks({ d: data([AGENT]) }) as unknown as El
    const thead = [...walk(root)].find((e) => e.type === 'thead')
    expect(thead).toBeTruthy()
    const colHeaders = [...walk(thead)].filter((e) => e.type === 'th')
    expect(colHeaders.length).toBe(13)
    for (const h of colHeaders) expect(h.props.scope).toBe('col')
    // ux2-01: corner header pins with the sticky name column like the
    // sibling coverage grid; remaining 12 week headers stay cx-num.
    expect(colHeaders[0].props.className).toBe('qa-cov__name')
    expect(String(colHeaders[0].props.children)).toBe('Agent')
    for (const h of colHeaders.slice(1)) expect(h.props.className).toBe('cx-num')
  })

  it('empty state stays a single <td colSpan={13}> row, not a th', () => {
    const root = AgentWeeks({ d: data([]) }) as unknown as El
    const rows = bodyRows(root)
    expect(rows).toHaveLength(1)
    const kids = Array.isArray(rows[0].props.children)
      ? rows[0].props.children
      : [rows[0].props.children]
    expect(kids).toHaveLength(1)
    const cell = kids[0] as El
    expect(cell.type).toBe('td')
    expect(cell.props.colSpan).toBe(13)
  })
})
