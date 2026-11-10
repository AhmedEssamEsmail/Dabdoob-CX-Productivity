import 'server-only'
import type { TableMapping } from '../engine'

const asText = (value: unknown) => String(value ?? '').trim()

const AGENT_ONE_ON_ONE_FIELDS = [
  'wins', 'coaching', 'concerns', 'challenges', 'projects', 'taskreview',
  'assignedtasks', 'nextsteps', 'rating',
]

const TL_ONE_ON_ONE_FIELDS = [
  'agenda', 'morale', 'wins', 'prev', 'obs', 'coaching', 'concerns',
  'tlactions', 'mgractions', 'rating', 'challenges', 'projects',
  'taskreview', 'assignedtasks',
]

const packSummary = (row: Record<string, unknown>, fields: string[]) => {
  const parts = fields.map((field) => {
    const value = asText(row[field])
    return value ? `${field}: ${value}` : ''
  }).filter(Boolean)
  row.summary = parts.join('\n') || ' '
}

export const MAPPINGS: TableMapping[] = [
  {
    spreadsheet: 'v1_ops', sheet: 'AgentOneOnOnes', table: 'one_on_one_logs',
    columns: ['log_id', 'kind', 'manager_email', 'report_email', 'held_at',
      'summary', 'submitted_at'],
    sheetToDb: {
      log_id: 'id',
      manager_email: 'tl',
      report_email: 'agentemail',
      held_at: 'date',
      submitted_at: 'savedat',
    },
    upsertOn: 'log_id',
    require: ['log_id'],
  },
  {
    spreadsheet: 'v1_ops', sheet: 'OneOnOnes', table: 'one_on_one_logs',
    columns: ['log_id', 'kind', 'manager_email', 'report_email', 'held_at',
      'summary', 'submitted_at'],
    sheetToDb: {
      log_id: 'id',
      report_email: 'tl',
      held_at: 'date',
      submitted_at: 'savedat',
    },
    upsertOn: 'log_id',
    require: ['log_id'],
  },
]

export const ROW_TRANSFORMS: Record<
  string,
  (row: Record<string, unknown>, ctx: { spreadsheet: string; table: string; index: number }) => void
> = {
  AgentOneOnOnes: (row, ctx) => {
    if (ctx.spreadsheet !== 'v1_ops' || ctx.table !== 'one_on_one_logs') return
    row.kind = 'v1_agent_1on1'
    if (asText(row.id)) row.id = 'v1-agent-' + asText(row.id)
    packSummary(row, AGENT_ONE_ON_ONE_FIELDS)
  },
  OneOnOnes: (row, ctx) => {
    if (ctx.spreadsheet !== 'v1_ops' || ctx.table !== 'one_on_one_logs') return
    row.kind = 'v1_tl_1on1'
    if (asText(row.id)) row.id = 'v1-tl-' + asText(row.id)
    row.manager_email = 'mohamed.nabil@dabdoob.com'
    packSummary(row, TL_ONE_ON_ONE_FIELDS)
  },
}

export const DECISIONS: string[] = [
  'v1_ops:TeamLeads (6 rows) -> sched_team upsertOn tl_email — owned by mappings/v1-ops-sched.ts (scheduling scope, S06-05); not duplicated here',
  'v1_ops:AgentOneOnOnes (37 rows) -> one_on_one_logs upsertOn log_id; log_id<-id, manager_email<-tl, report_email<-agentemail, held_at<-date, submitted_at<-savedat; kind=v1_agent_1on1; summary concatenates wins/coaching/concerns/challenges/projects/taskReview/assignedTasks/nextSteps/rating; log_id is namespaced "v1-agent-"+id; tl is a display name and agentName is unmapped',
  'v1_ops:OneOnOnes (9 rows) -> one_on_one_logs upsertOn log_id; log_id<-id, report_email<-tl, held_at<-date, submitted_at<-savedat; kind=v1_tl_1on1; log_id is namespaced "v1-tl-"+id; manager_email is the inferred constant mohamed.nabil@dabdoob.com pending PM confirmation; summary concatenates agenda/morale/wins/prev/obs/coaching/concerns/tlActions/mgrActions/rating/challenges/projects/taskReview/assignedTasks; tl is a display name',
  'v1_ops:Agents rejected — header-only empty store (email,name,tl; 0 data rows); would-be holder roster, nothing to migrate',
  'v1_ops:KPI rejected — header-only empty store (name,tl,prod,qual,overall,adh,added; 0 data rows); would-be holder tlp_team/kpi_*_log family, nothing to migrate',
  'v1_ops:Standups rejected — header-only empty store (date,savedAt,sd1..sd7; 0 data rows); would-be holder meetings or NEW table, moot because there is no data',
]
