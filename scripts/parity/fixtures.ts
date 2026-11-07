 
/**
 * Fixture payloads for the five highest-risk pages. Each fixture is the exact
 * server payload the page's load call returns — same object the legacy GAS fn
 * (`getQaFormsPage` etc.) and the ported Next route (`/api/qa/getQaFormsPage`
 * etc.) produce. Scenarios are chosen to exercise the initial-view branches:
 * mixed statuses, chips, empty vs populated sections, admin gates.
 */
export interface FixtureSet {
  /** legacy: resolve a google.script.run fn call to its payload. */
  gas: (fn: string, args: unknown[]) => { data?: unknown; error?: unknown } | undefined
  /** port: resolve a fetch() call (method, url, parsed body) to its payload. */
  api: (method: string, url: string, body: unknown) => unknown
}

const DROPDOWN_OPTIONS: Record<string, string[]> = {
  'qa.channel': ['Call', 'Chat', 'Email'],
  'qa.audit_type': ['Cash refund'],
  'people.meeting_type': ['1:1', 'Team meeting', 'BR'],
}

export const BOOT = {
  user: { role: 'admin', name: 'QA Admin', email: 'admin@dabdoob.com' },
  isOwner: true,
  viewAs: { canUse: true, target: null },
  popups: [],
  appUrls: {},
}

/* ---------------- qa-forms ---------------- */

const QA_FORMS_PAGE = {
  forms: [
    {
      formId: 'FRM001',
      title: 'Calls — standard',
      channel: 'Call',
      version: 3,
      versions: 3,
      active: true,
      placeholder: false,
      scoring: 'weighted',
      sections: [
        {
          id: 'sec1',
          title: 'Opening & verification',
          questions: [
            { id: 'q1', text: 'Greets within ten seconds', weight: 20, fatal: false, hint: '' },
            { id: 'q2', text: 'Verifies the account with two tokens', weight: 30, fatal: true, hint: 'ID + registered phone' },
          ],
        },
        {
          id: 'sec2',
          title: 'Resolution',
          questions: [{ id: 'q3', text: 'Resolves or escalates correctly', weight: 50, fatal: false, hint: '' }],
        },
      ],
    },
    {
      formId: 'FRM002',
      title: 'Cash refund audit',
      channel: 'Cash refund',
      version: 1,
      versions: 1,
      active: false,
      placeholder: true,
      scoring: 'deduction',
      sections: [
        {
          id: 'sec1',
          title: 'Checks',
          questions: [{ id: 'q1', text: 'Refund amount matches receipt', weight: 100, fatal: true, hint: '' }],
        },
      ],
    },
  ],
  channels: ['Call', 'Chat', 'Email'],
  auditTypes: ['Cash refund'],
}

/* ---------------- audit-queue ---------------- */

const QA_QUEUE_PAGE = {
  today: '2026-11-06',
  ticketUrl: 'https://dabdoob.freshdesk.com/a/tickets/',
  isAdmin: true,
  readOnly: false,
  viewing: null,
  engineLive: true,
  importedAt: '2026-11-06T06:30:00Z',
  channels: ['Call', 'Chat', 'Email'],
  auditTypes: ['Cash refund'],
  passReasons: ['Duplicate draw', 'Agent on leave', 'Already covered by CTL', 'Out of scope'],
  canRequest: true,
  canWaive: true,
  weekStart: '2026-11-02',
  selfEmail: 'admin@dabdoob.com',
  auditors: [
    { email: 'sara.qa@dabdoob.com', name: 'Sara Qa' },
    { email: 'omar.qa@dabdoob.com', name: 'Omar Qa' },
  ],
  rows: [
    {
      queueId: 'Q001',
      date: '2026-11-06',
      ticketId: '118421',
      agentEmail: 'agent.one@dabdoob.com',
      agentName: 'Agent One',
      tlEmail: 'tl.one@dabdoob.com',
      tlName: 'TL One',
      channel: 'Call',
      contactType: 'Complaint',
      tier: 'L1',
      auditType: '',
      reference: '',
      source: '',
      note: '',
      createdByName: '',
      createdAt: '',
      interactionAt: '2026-11-05 14:32',
      actionAt: '2026-11-05 14:32',
      agentStatus: 'Resolved',
      agentStatusLog: '',
      ticketStatus: 'Open',
      passReason: '',
      passedByName: '',
      passedAt: '',
      auditorEmail: 'admin@dabdoob.com',
      auditorName: 'QA Admin',
      status: 'open',
      startedAt: '',
      auditId: '',
      takenByOther: false,
      repeatFails: 2,
    },
    {
      queueId: 'Q002',
      date: '2026-11-06',
      ticketId: '118430',
      agentEmail: 'agent.two@dabdoob.com',
      agentName: 'Agent Two',
      tlEmail: 'tl.one@dabdoob.com',
      tlName: 'TL One',
      channel: 'Chat',
      contactType: 'Order status',
      tier: 'L1',
      auditType: '',
      reference: '',
      source: '',
      note: '',
      createdByName: '',
      createdAt: '',
      interactionAt: '2026-11-05 16:10',
      actionAt: '',
      agentStatus: 'Pending',
      agentStatusLog: '',
      ticketStatus: 'Pending',
      passReason: '',
      passedByName: '',
      passedAt: '',
      auditorEmail: 'admin@dabdoob.com',
      auditorName: 'QA Admin',
      status: 'in_progress',
      startedAt: '2026-11-06T09:12:00Z',
      auditId: 'QA991',
      takenByOther: false,
      repeatFails: 0,
    },
    {
      queueId: 'Q003',
      date: '2026-11-05',
      ticketId: '118399',
      agentEmail: 'agent.three@dabdoob.com',
      agentName: 'Agent Three',
      tlEmail: 'tl.two@dabdoob.com',
      tlName: 'TL Two',
      channel: 'Email',
      contactType: 'Return request',
      tier: 'L2',
      auditType: '',
      reference: '',
      source: '',
      note: '',
      createdByName: '',
      createdAt: '',
      interactionAt: '2026-11-04 11:00',
      actionAt: '2026-11-04 11:00',
      agentStatus: 'Resolved',
      agentStatusLog: '',
      ticketStatus: 'Resolved',
      passReason: '',
      passedByName: '',
      passedAt: '',
      auditorEmail: 'sara.qa@dabdoob.com',
      auditorName: 'Sara Qa',
      status: 'done',
      startedAt: '2026-11-05T10:00:00Z',
      auditId: 'QA990',
      takenByOther: false,
      repeatFails: 0,
    },
    {
      queueId: 'Q004',
      date: '2026-11-06',
      ticketId: '118450',
      agentEmail: 'agent.one@dabdoob.com',
      agentName: 'Agent One',
      tlEmail: 'tl.one@dabdoob.com',
      tlName: 'TL One',
      channel: 'Call',
      contactType: 'Refund',
      tier: 'L1',
      auditType: '',
      reference: '',
      source: 'offqueue',
      note: '',
      createdByName: 'QA Admin',
      createdAt: '2026-11-06T08:00:00Z',
      interactionAt: '2026-11-06 08:05',
      actionAt: '',
      agentStatus: 'Open',
      agentStatusLog: '',
      ticketStatus: 'Open',
      passReason: '',
      passedByName: '',
      passedAt: '',
      auditorEmail: 'admin@dabdoob.com',
      auditorName: 'QA Admin',
      status: 'open',
      startedAt: '',
      auditId: '',
      takenByOther: false,
      repeatFails: 0,
    },
  ],
  forms: [
    {
      formId: 'FRM001',
      title: 'Calls — standard',
      channel: 'Call',
      version: 3,
      active: true,
      placeholder: false,
      scoring: 'weighted',
      sections: [
        {
          id: 'sec1',
          title: 'Opening',
          optional: false,
          questions: [
            { id: 'q1', text: 'Greeting within ten seconds', weight: 20, fatal: false, hint: '' },
            { id: 'q2', text: 'Verified two tokens', weight: 30, fatal: true, hint: '' },
          ],
        },
        {
          id: 'sec2',
          title: 'Resolution',
          optional: false,
          questions: [{ id: 'q3', text: 'Correct resolution', weight: 50, fatal: false, hint: '' }],
        },
      ],
    },
    {
      formId: 'FRM003',
      title: 'Every-channel fallback',
      channel: '*',
      version: 2,
      active: true,
      placeholder: false,
      scoring: 'weighted',
      sections: [
        {
          id: 'sec1',
          title: 'Basics',
          optional: false,
          questions: [{ id: 'q1', text: 'Followed the process', weight: 100, fatal: false, hint: '' }],
        },
      ],
    },
    {
      formId: 'FRM004',
      title: 'Cash refund audit',
      channel: 'Cash refund',
      version: 1,
      active: true,
      placeholder: false,
      scoring: 'deduction',
      sections: [
        {
          id: 'sec1',
          title: 'Checks',
          optional: false,
          questions: [{ id: 'q1', text: 'Refund matches receipt', weight: 100, fatal: true, hint: '' }],
        },
      ],
    },
  ],
  requests: [
    {
      queueId: 'RQ01',
      date: '2026-11-06',
      ticketId: '118440',
      agentEmail: 'agent.two@dabdoob.com',
      agentName: 'Agent Two',
      tlEmail: 'tl.one@dabdoob.com',
      tlName: 'TL One',
      channel: 'Chat',
      contactType: 'Complaint',
      auditType: '',
      reference: '',
      source: 'request',
      note: '',
      requestReason: 'Escalated by the floor TL',
      requestedByName: 'TL One',
      requestedAt: '2026-11-06T07:45:00Z',
      interactionAt: '2026-11-05 18:00',
      actionAt: '',
      agentStatus: 'Open',
      ticketStatus: 'Open',
      status: 'open',
      passReason: '',
      repeatFails: 1,
    },
  ],
  passed: [
    {
      queueId: 'Q090',
      date: '2026-11-03',
      ticketId: '118301',
      agentName: 'Agent Four',
      channel: 'Call',
      reason: 'Agent on leave',
      passedByName: 'QA Admin',
      passedAt: '2026-11-03T09:00:00Z',
    },
  ],
  quota: [
    { email: 'agent.one@dabdoob.com', name: 'Agent One', quota: 4, audited: 4, seen: 12 },
    { email: 'agent.two@dabdoob.com', name: 'Agent Two', quota: 4, audited: 2, seen: 8 },
  ],
  quotaWeeks: [
    {
      weekStart: '2026-11-02',
      rows: [
        { email: 'agent.one@dabdoob.com', name: 'Agent One', quota: 20, audited: 4, seen: 12,
          days: [4, 3, 4, 4, 2, 0, 0], perDay: 4, done: 17, requested: 2, waiting: 1, remaining: 3 },
        { email: 'agent.two@dabdoob.com', name: 'Agent Two', quota: 20, audited: 2, seen: 8,
          days: [4, 4, 4, 4, 4, 0, 0], perDay: 4, done: 20, requested: 0, waiting: 0, remaining: 0 },
      ],
    },
  ],
  mine: { week: 3, month: 12, day: 1 },
  failMemory: {
    'agent.one@dabdoob.com': {
      q2: { text: 'Verified two tokens', repeat: true, count: 2 },
    },
  },
  unmatched: [{ name: 'Ghost Agent', items: 2 }],
}

/* ---------------- scheduler ---------------- */

// schForRole_ returns { me, plan:{...}, timeline:{rows}, regen }.
// The month view reads plan.days[].key/.name, plan.tls, plan.grid[tl][key],
// plan.gaps, plan.monthName, and the tab strip; timeline feeds hour-by-hour.
const SCHED_PLAN = {
  me: { email: 'admin@dabdoob.com', name: 'CX Admin', role: 'admin' },
  regen: null,
  plan: {
    monthName: 'November 2026',
    year: 2026,
    month: 10,
    variant: 0,
    tls: ['tl.one@dabdoob.com', 'tl.two@dabdoob.com'],
    names: { 'tl.one@dabdoob.com': 'TL One', 'tl.two@dabdoob.com': 'TL Two' },
    days: [
      { key: '2026-11-05', name: 'Thu 5', weekday: 'Thu' },
      { key: '2026-11-06', name: 'Fri 6', weekday: 'Fri' },
      { key: '2026-11-07', name: 'Sat 7', weekday: 'Sat' },
      { key: '2026-11-08', name: 'Sun 8', weekday: 'Sun' },
      { key: '2026-11-09', name: 'Mon 9', weekday: 'Mon' },
      { key: '2026-11-10', name: 'Tue 10', weekday: 'Tue' },
      { key: '2026-11-11', name: 'Wed 11', weekday: 'Wed' },
    ],
    grid: {
      'tl.one@dabdoob.com': {
        '2026-11-05': { shift: 'AM', start: '08:00', end: '16:00', manual: false, wfh: false },
        '2026-11-06': { shift: 'AM', start: '08:00', end: '16:00', manual: true, wfh: true },
        '2026-11-07': { shift: 'OFF', start: '', end: '', manual: false, wfh: false },
        '2026-11-08': { shift: 'PM', start: '14:00', end: '22:00', manual: false, wfh: false },
        '2026-11-09': { shift: 'PM', start: '14:00', end: '22:00', manual: false, wfh: false },
        '2026-11-10': { shift: 'LEAVE', leave: true, start: '', end: '', manual: false, wfh: false },
        '2026-11-11': { shift: 'AM', start: '08:00', end: '16:00', manual: false, wfh: false },
      },
      'tl.two@dabdoob.com': {
        '2026-11-05': { shift: 'PM', start: '14:00', end: '22:00', manual: false, wfh: false },
        '2026-11-06': { shift: 'OFF', start: '', end: '', manual: false, wfh: false },
        '2026-11-07': { shift: 'OFF', start: '', end: '', manual: true, wfh: false },
        '2026-11-08': { shift: 'AM', start: '08:00', end: '16:00', manual: false, wfh: true },
        '2026-11-09': { shift: 'AM', start: '08:00', end: '16:00', manual: false, wfh: false },
        '2026-11-10': { shift: 'PM', start: '14:00', end: '22:00', manual: false, wfh: false },
        '2026-11-11': { shift: 'PM', start: '14:00', end: '22:00', manual: true, wfh: false },
      },
    },
    gaps: [{ date: '2026-11-09', hour: 12, need: 1 }],
    coverage: [],
    notes: [],
    problems: [],
    exceptions: [],
    totals: {
      'tl.one@dabdoob.com': { am: 3, pm: 2 },
      'tl.two@dabdoob.com': { am: 2, pm: 3 },
    },
  },
  timeline: {
    conflicts: [],
    rows: [
      {
        tl: 'tl.one@dabdoob.com',
        name: 'TL One',
        date: '2026-11-05',
        from: '08:00',
        to: '16:00',
        segments: [
          { from: '08:00', to: '10:00', kind: 'queue', label: 'Queue' },
          { from: '10:00', to: '11:00', kind: 'meeting', label: 'BR' },
          { from: '11:00', to: '16:00', kind: 'queue', label: 'Queue' },
        ],
      },
      {
        tl: 'tl.two@dabdoob.com',
        name: 'TL Two',
        date: '2026-11-05',
        from: '14:00',
        to: '22:00',
        segments: [{ from: '14:00', to: '22:00', kind: 'queue', label: 'Queue' }],
      },
    ],
  },
}

/* ---------------- tl-performance ---------------- */

const TLP_PAGE = {
  tls: [
    { email: 'tl.one@dabdoob.com', name: 'TL One' },
    { email: 'tl.two@dabdoob.com', name: 'TL Two' },
  ],
  tl: 'tl.one@dabdoob.com',
  name: 'TL One',
  from: '2026-10-31',
  to: '2026-11-06',
  week: '2026-W45',
  canRate: true,
  zones: { meets: 75, exceeds: 95 },
  team: {
    quality: 91.5,
    fcr: 72,
    productivity: 104.2,
    agents: 9,
    month: '2026-11',
    asOf: '2026-11-06T06:00:00Z',
    kpi: {
      score: 88.4,
      prod: 104.2,
      qual: 91.5,
      fcr: 72,
      behavior: 96,
      agents: 9,
      olAgents: 1,
      ineligible: 0,
      redZone: 1,
      actionPlan: 2,
      probation: 1,
      partial: 0,
    },
  },
  responsibilities: 81.7,
  overall: { score: 86.2, weights: { team: 85, responsibilities: 15 }, missing: [] },
  areas: [
    {
      area: 'Team quality',
      target: '90%+ QA pass',
      measuredBy: 'Weekly QA average of the team',
      value: 92,
      label: 'Meets',
      note: '',
      history: [
        { week: '2026-W44', value: 88 },
        { week: '2026-W43', value: 90 },
      ],
      measured: { pct: 91.5, met: 40, total: 44, rule: 'QA pass rate', from: 'qa_audits' },
    },
    {
      area: 'Knowledge base',
      target: 'Gaps closed weekly',
      measuredBy: 'KB tracker',
      value: 60,
      label: 'Below',
      note: 'Two gaps stayed open past the SLA window.',
      history: [{ week: '2026-W44', value: 70 }],
      measured: { pct: 60, met: 3, total: 5, rule: 'Gaps closed ≤7d', from: 'tlp_kb' },
      kb: { open: 2, closedThisMonth: 3, avgCloseDays: 6.5, oldestOpenDays: 12 },
    },
    {
      area: 'OTD',
      target: '95% on-time',
      measuredBy: 'Deliveries on time',
      value: null,
      label: 'Unrated',
      note: '',
      history: [],
      measured: null,
    },
  ],
  otd: { warehouses: ['Kuwait', 'Egypt', 'UAE'], months: [
    { month: '2026-10', values: [93.2, 91.0, 94.5], avg: 92.9 },
    { month: '2026-11', values: [95.1, null, 92.0], avg: 93.6 },
  ] },
  projects: [
    {
      actionId: 'ACT100',
      title: 'Coach bottom-quartile agents',
      dueDate: '2026-11-20',
      status: 'on_track',
      value: 80,
      label: 'Meets',
      note: '',
      ratedAt: '2026-11-05T12:00:00Z',
      history: [{ week: '2026-W44', value: 75 }],
    },
    {
      actionId: 'ACT101',
      title: 'KB refresh for returns policy',
      dueDate: '2026-11-08',
      status: 'at_risk',
      value: null,
      label: '',
      note: '',
      ratedAt: '',
      history: [],
    },
  ],
  queue: {
    days: [
      { date: '2026-11-04', windows: '08-12', queueMin: 240, callsIn: 31, answerRate: 90.3, touches: 44, respAvgMin: 2.4, respCount: 31 },
      { date: '2026-11-05', windows: '08-16', queueMin: 480, callsIn: 58, answerRate: 88.1, touches: 71, respAvgMin: 3.1, respCount: 55 },
    ],
    total: { queueMin: 720, callsIn: 89, serviced: 79, abandoned: 10, answerRate: 88.8, touches: 115, respAvgMin: 2.8, respCount: 86 },
    source: 'maqsam',
    asOf: '2026-11-06T06:00:00Z',
  },
  mail: {
    open: 1,
    breached: 1,
    repliedByThem: 3,
    expected: 4,
    coveredByOther: 0,
    items: [
      {
        messageId: 'MSG1',
        gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/MSG1',
        subject: 'MyFatoorah refund update #991',
        status: 'replied',
        breached: false,
        coveringMissed: false,
        repliedBy: 'TL One',
        kind: 'refund',
        from: 'payments@myfatoorah.com',
        receivedAt: '2026-11-05T10:00:00Z',
        repliedAt: '2026-11-05T13:00:00Z',
        minutes: 180,
        dueAt: '2026-11-05T17:00:00Z',
        nextShift: false,
      },
      {
        messageId: 'MSG2',
        gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/MSG2',
        subject: 'Chargeback case 332',
        status: 'open',
        breached: true,
        coveringMissed: false,
        kind: 'chargeback',
        from: 'disputes@bank.example',
        receivedAt: '2026-11-04T09:00:00Z',
        dueAt: '2026-11-04T17:00:00Z',
        nextShift: false,
      },
    ],
  },
  notes: [],
}

/* ---------------- meetings ---------------- */

const MEETINGS_PAGE = {
  me: { email: 'tl.one@dabdoob.com', name: 'TL One', role: 'tl' },
  people: [
    { email: 'tl.one@dabdoob.com', name: 'TL One', role: 'tl' },
    { email: 'agent.one@dabdoob.com', name: 'Agent One', role: 'agent' },
    { email: 'admin@dabdoob.com', name: 'CX Admin', role: 'admin' },
  ],
  series: [
    {
      seriesId: 'SER01',
      meetingType: 'br',
      title: 'Weekly ops BR',
      chairEmail: 'tl.one@dabdoob.com',
      chairName: 'TL One',
      cadence: 'weekly',
      members: [
        { email: 'tl.one@dabdoob.com', name: 'TL One', role: 'chair' },
        { email: 'admin@dabdoob.com', name: 'CX Admin', role: 'attendee' },
      ],
      meetings: [
        {
          meetingId: 'MTG01',
          seriesId: 'SER01',
          heldAt: '2026-11-04T10:00:00Z',
          nextMeetingAt: '2026-11-11T10:00:00Z',
          notes: 'Covered queue backlog and staffing for the sale week.',
          decisions: 'Extra PM overlap on Friday.',
          status: 'held',
          closedAt: '2026-11-04T10:45:00Z',
          summarySentAt: '2026-11-04T10:50:00Z',
        },
        {
          meetingId: 'MTG00',
          seriesId: 'SER01',
          heldAt: '2026-10-28T10:00:00Z',
          nextMeetingAt: '2026-11-04T10:00:00Z',
          notes: '',
          decisions: '',
          status: 'held',
          closedAt: '2026-10-28T10:40:00Z',
          summarySentAt: '',
        },
      ],
      openActions: 2,
      canChair: true,
    },
    {
      seriesId: 'SER02',
      meetingType: 'team',
      title: 'Team standup',
      chairEmail: 'admin@dabdoob.com',
      chairName: 'CX Admin',
      cadence: 'daily',
      members: [
        { email: 'admin@dabdoob.com', name: 'CX Admin', role: 'chair' },
        { email: 'tl.one@dabdoob.com', name: 'TL One', role: 'attendee' },
        { email: 'agent.one@dabdoob.com', name: 'Agent One', role: 'attendee' },
      ],
      meetings: [],
      openActions: 0,
      canChair: false,
    },
  ],
  myActions: [
    {
      actionId: 'ACT200',
      title: 'Send updated escalation list to WFM',
      description: '',
      ownerEmail: 'tl.one@dabdoob.com',
      ownerName: 'TL One',
      assignedBy: 'admin@dabdoob.com',
      dueDate: '2026-11-08',
      sourceType: 'meeting',
      sourceId: 'MTG01',
      seriesId: 'SER01',
      topic: '',
      status: 'open',
      outcomeNote: '',
      closedAt: '',
      visibility: 'shared',
      trackAsTask: true,
      carryCount: 1,
      sourceDeleted: false,
      createdAt: '2026-11-04T10:30:00Z',
    },
    {
      actionId: 'ACT201',
      title: 'Review holiday roster overlaps',
      description: '',
      ownerEmail: 'tl.one@dabdoob.com',
      ownerName: 'TL One',
      assignedBy: 'admin@dabdoob.com',
      dueDate: '2026-11-15',
      sourceType: 'meeting',
      sourceId: 'MTG01',
      seriesId: 'SER01',
      topic: '',
      status: 'in_progress',
      outcomeNote: '',
      closedAt: '',
      visibility: 'shared',
      trackAsTask: false,
      carryCount: 0,
      sourceDeleted: false,
      createdAt: '2026-11-04T10:31:00Z',
    },
  ],
}

/* ---------------- dispatchers ---------------- */

const GAS: Record<string, Record<string, unknown>> = {
  'qa-forms': { getQaFormsPage: QA_FORMS_PAGE, getDropdownOptions: null },
  'audit-queue': { getQaQueuePage: QA_QUEUE_PAGE, getDropdownOptions: null },
  scheduler: { schedulerPlan: SCHED_PLAN, getDropdownOptions: null },
  'tl-performance': { tlPerformancePage: TLP_PAGE, getDropdownOptions: null },
  meetings: { meetingsPage: MEETINGS_PAGE, getDropdownOptions: null },
}

export function fixturesFor(pageKey: string): FixtureSet {
  const table = GAS[pageKey] ?? {}
  return {
    gas(fn, args) {
      if (fn in table && table[fn] !== null) return { data: table[fn] }
      if (fn === 'getDropdownOptions') return { data: DROPDOWN_OPTIONS[String(args[0] ?? '')] ?? [] }
      return undefined
    },
    api(method, url, body) {
      void body
      const u = new URL(url, 'https://parity.local')
      const p = u.pathname
      if (p === '/api/qa/getQaFormsPage') return QA_FORMS_PAGE
      if (p === '/api/qa/getQaQueuePage') return QA_QUEUE_PAGE
      if (p === '/api/qa/getQaAccess') return { people: [], positions: [] }
      if (p === '/api/qa/getQaSamplingPage') return { contactTypes: [], statuses: [], agents: [], lastBuild: '' }
      if (p === '/api/queue/scheduler' && method === 'GET' && !u.searchParams.get('view')) return SCHED_PLAN
      if (p === '/api/queue/scheduler' && u.searchParams.get('view') === 'settings') return { tls: [], daysOff: [], requests: [] }
      if (p === '/api/queue/scheduler' && u.searchParams.get('view') === 'offdays') return { days: [] }
      if (p === '/api/queue/scheduler' && u.searchParams.get('view') === 'requests') return { requests: [] }
      if (p === '/api/tl/page') return TLP_PAGE
      if (p === '/api/people/meetings') return MEETINGS_PAGE
      if (p.startsWith('/api/options/')) return DROPDOWN_OPTIONS[decodeURIComponent(p.split('/').pop() ?? '')] ?? []
      return { error: `unstubbed api call: ${method} ${url}` }
    },
  }
}
