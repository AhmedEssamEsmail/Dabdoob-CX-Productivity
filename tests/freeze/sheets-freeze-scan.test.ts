/**
 * Sheets-freeze repo-scan gate (spec qa-live-sheets-freeze, leaf S01-04).
 *
 * Wave 1 froze all Google Sheets reads behind assertSheetReadAllowed_ inside the
 * two seams (jobs/sheets.ts fetchWorkbookTabs, migration/engine.ts readSheet/
 * readSheetRaw). This test walks src/ + scripts/ and fails when a file uses any
 * sheet-read pattern outside EXPECTED — a NEW reader must either go through the
 * guarded seams or get an explicit, reviewed allowlist entry here.
 *
 * EXPECTED snapshot = post-S01-03 tree. Entries tagged DEFERRED log
 * [SHEETS_FREEZE_VIOLATION] and pass until wave-2 leaves replace them with DB
 * reads; USER-OWNED files are cx-quality hand-backs; NON-SHEETS entries match
 * only the `googleapis` literal (gmail/drive scopes) and stay gated on the
 * other four patterns. Wave-2 end state shrinks EXPECTED to the two seams.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SCAN_DIRS = ['src', 'scripts']
const SKIP_DIRS = new Set(['node_modules', '.next', 'tests', 'specs', 'e2e', 'dist', 'coverage'])
const SRC_EXT = new Set(['.ts', '.tsx', '.mts'])

const PATTERNS: Record<string, RegExp> = {
  googleapis: /googleapis/,
  'spreadsheets.values': /spreadsheets\.values/,
  fetchWorkbookTabs: /fetchWorkbookTabs/,
  'readSheet(': /readSheet\(/,
  'readSheetRaw(': /readSheetRaw\(/,
}
type PatternName = keyof typeof PATTERNS

/** file -> patterns it may contain (verified against the post-S01-03 tree) */
const EXPECTED: Record<string, readonly PatternName[]> = {
  // --- the two guarded seams; wave-2 keeps ONLY these as sheet readers ---
  'src/features/shared/jobs/sheets.ts': ['googleapis', 'spreadsheets.values', 'fetchWorkbookTabs'], // fetchWorkbookTabs def; per-tab assert before values.get
  'src/features/shared/migration/engine.ts': ['googleapis', 'spreadsheets.values', 'readSheet(', 'readSheetRaw('], // readSheet/readSheetRaw defs + internal DEFERRED migration calls
  // --- DEFERRED wave-1 fetchWorkbookTabs readers (log + pass; wave-2 removes) ---
  'src/features/cx-queue/lib/tlqueue.ts': ['fetchWorkbookTabs'],
  'src/features/cx-queue/lib/heatmap.ts': ['fetchWorkbookTabs'],
  'src/features/cx-people/lib/scorecard-server.ts': ['fetchWorkbookTabs'],
  'src/app/api/admin/source-health/route.ts': ['fetchWorkbookTabs'], // diagnostics; S10 -> DB probes
  'src/app/api/admin/mirrors/route.ts': ['fetchWorkbookTabs'], // peek probe
  // --- manual allowlist (fail-closed roster sync) ---
  'src/features/cx-hub/lib/roster.ts': ['readSheet('], // manualHct 'Sheet1'
  // --- USER-OWNED cx-quality (hand-back; dead 'Queue Log' path throws by design) ---
  'src/features/cx-quality/lib/server.ts': ['fetchWorkbookTabs'],
  'src/features/cx-quality/lib/migrate.ts': ['googleapis', 'spreadsheets.values'],
  // --- admin diagnostic: lists tab names (read-only) ---
  'src/app/api/admin/list-sheets/route.ts': ['googleapis', 'spreadsheets.values'],
  // --- NON-SHEETS googleapis literals (gmail/calendar/drive); still gated on the other patterns ---
  'src/features/cx-hub/lib/myday-google.ts': ['googleapis'],
  'src/features/shared/components/shell/registry.ts': ['googleapis'], // gmail.send scope URL string only
  // --- ops scripts ---
  'scripts/ops/qa-recon-sheet.ts': ['fetchWorkbookTabs'], // qa_queue read now throws by design
  'scripts/ops/check-sheet-access.mts': ['googleapis', 'spreadsheets.values'], // access-diagnostic script
  'scripts/ops/seed-prod-assumptions.ts': ['fetchWorkbookTabs'], // EXEMPT one-time prod seed (S11-02, PLAN Amendment 3); passes {deferred:true}
}

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) yield* walk(p)
    } else if (SRC_EXT.has(path.extname(e.name))) {
      yield p
    }
  }
}

function rel(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join('/')
}

describe('sheets-freeze repo-scan gate', () => {
  it('no sheet-read pattern appears outside the EXPECTED allowlist', () => {
    const hits = new Map<string, Set<PatternName>>()
    for (const dir of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const text = readFileSync(file, 'utf8')
        const found = new Set<PatternName>()
        for (const [name, rx] of Object.entries(PATTERNS)) {
          if (rx.test(text)) found.add(name as PatternName)
        }
        if (found.size) hits.set(rel(file), found)
      }
    }
    const offenders: string[] = []
    for (const [file, pats] of hits) {
      const allowed = new Set<PatternName>(EXPECTED[file] ?? [])
      const extra = [...pats].filter((p) => !allowed.has(p))
      if (extra.length) offenders.push(`${file} (${extra.join(', ')})`)
    }
    expect(
      offenders,
      'new sheet reader outside allowlist — route through the guarded seams or add a reviewed EXPECTED entry:\n' +
        offenders.map((o) => '  ' + o).join('\n')
    ).toEqual([])
  })

  it('sheets-freeze.ts exists and carries the ops-grep marker strings', () => {
    const guard = path.join(ROOT, 'src/features/shared/lib/sheets-freeze.ts')
    expect(existsSync(guard), 'src/features/shared/lib/sheets-freeze.ts is missing').toBe(true)
    const text = readFileSync(guard, 'utf8')
    expect(text).toContain('SHEETS_FREEZE_VIOLATION')
    expect(text).toContain('SheetsFreezeError')
  })
})
