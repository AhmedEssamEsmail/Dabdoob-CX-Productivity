 
/**
 * Per-page harness config: where the closure lives, which symbol is the page
 * component, which route props both sides receive, module-scope seeds the
 * legacy bundle needs (boot stores the shell normally populates), and how to
 * import the ported component.
 */
export interface PageCfg {
  key: string
  app: string
  closureFile: string
  pageSymbol: string
  routeProps: Record<string, unknown>
  /** module-scope `let` vars seeded through the eval escape (e.g. Fn boot). */
  seeds: Record<string, unknown>
  /** dynamic import specifier (repo-root relative) + export name. */
  portModule: string
  portExport: string
  /** human note on the fixture scenario exercised. */
  scenario: string
}

export const PAGES: PageCfg[] = [
  {
    key: 'qa-forms',
    app: 'quality',
    closureFile: 'quality/pages/qa-forms.closure.js',
    pageSymbol: 'yl',
    routeProps: { route: { title: 'Audit forms' } },
    seeds: {},
    portModule: 'cx-quality/components/qa-forms-page',
    portExport: 'QaFormsPage',
    scenario: 'two forms (weighted Call v3 + deduction placeholder Cash-refund v1), one non-ticket audit type, three channels',
  },
  {
    key: 'audit-queue',
    app: 'quality',
    closureFile: 'quality/pages/audit-queue.closure.js',
    pageSymbol: 'qs',
    routeProps: { route: { title: 'Audit Desk' } },
    // qs reads St() -> Fn (the bundle-scoped boot object): admin -> who='*'.
    seeds: { Fn: { user: { role: 'admin', name: 'QA Admin', email: 'admin@dabdoob.com' } } },
    portModule: 'cx-quality/components/audit-queue-page',
    portExport: 'default',
    scenario: 'admin opens own desk (who=*, readOnly=false): 4 queue rows across open/in_progress/done/non-ticket, 2 active forms, fail-memory, quota weeks, passed list, requests, import stamp',
  },
  {
    key: 'scheduler',
    app: 'queue',
    closureFile: 'queue/pages/scheduler.closure.js',
    pageSymbol: 'Ll',
    routeProps: { route: { title: 'TL scheduler' } },
    seeds: {},
    portModule: 'cx-queue/components/scheduler-page',
    portExport: 'SchedulerPage',
    scenario: 'admin, current month: 2 TLs × 3 visible day columns (AM/PM/OFF+LEAVE/manual/WFH), gaps, timeline rows, month view',
  },
  {
    key: 'tl-performance',
    app: 'desk',
    closureFile: 'desk/pages/tl-performance.closure.js',
    pageSymbol: 'yr',
    routeProps: { route: { title: 'TL performance', purpose: "A team lead's week: team scores, responsibilities, projects against expectation, queue hours and mails to answer." } },
    seeds: {},
    portModule: 'cx-desk/components/tl-performance-page',
    portExport: 'default',
    scenario: 'admin viewing first TL: team KPI scores, 3 responsibility areas (one rated-below w/ note, KB area w/ kb metrics), OTD, 2 projects, queue days, mail',
  },
  {
    key: 'meetings',
    app: 'people',
    closureFile: 'people/pages/meetings.closure.js',
    pageSymbol: 'pa',
    routeProps: { route: { title: 'Meetings & BRs', purpose: 'Notes and action items from meetings and business reviews, reviewed at the next one.' } },
    seeds: {},
    portModule: 'cx-people/components/meetings-page',
    portExport: 'MeetingsPage',
    scenario: 'tl with 2 series (BR chaired by me w/ 2 meetings + open actions, team meeting by other chair), 2 open my-actions, 3 people',
  },
]
