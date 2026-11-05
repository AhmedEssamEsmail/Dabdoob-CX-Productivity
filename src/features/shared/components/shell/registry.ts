/**
 * The literal page registry and grouping constants from the legacy bundle
 * (Z, da, Nt, Zt, Jt, gs, Zn/apps). Generated verbatim — do not hand-edit.
 */

export interface RouteDef {
  path: string
  title: string
  group: string
  reqs: number[]
  roles: string[]
  purpose: string
}

/** Z — all 40 pages across the CX Helm suite. */
export const PAGES: RouteDef[] = [
  {
    "path": "my-day",
    "title": "My day",
    "group": "hub",
    "reqs": [
      17
    ],
    "roles": [
      "admin"
    ],
    "purpose": "Your meetings, deadlines, mail waiting on you and recent files, with focus blocks you can book."
  },
  {
    "path": "overview",
    "title": "Home",
    "group": "hub",
    "reqs": [],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "What needs you right now, then every queue and how old its work is."
  },
  {
    "path": "people-holidays",
    "title": "People & holidays",
    "group": "hub",
    "reqs": [],
    "roles": [
      "admin"
    ],
    "purpose": "Where each person is based, their days off, and public holidays by country."
  },
  {
    "path": "admin",
    "title": "Admin",
    "group": "hub",
    "reqs": [],
    "roles": [
      "admin"
    ],
    "purpose": "Roster, settings, dropdown choices, email log and scheduled jobs."
  },
  {
    "path": "quality-scores",
    "title": "Team scores",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "The team score for this month or any dates you pick, its trend, and the team leads, agents and channels behind it."
  },
  {
    "path": "audit-queue",
    "title": "Audit Desk",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Four audits per agent per day: open one, score it live in the form, and the agent gets the result by email."
  },
  {
    "path": "my-audits",
    "title": "My audits",
    "group": "quality",
    "reqs": [],
    "roles": [
      "agent"
    ],
    "purpose": "Your quality audits and what lost marks; confirm your coaching (CTL) with your team lead happened."
  },
  {
    "path": "ctls",
    "title": "CTLs",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Go through each audit under 100% with the agent within 2 working days (3 over a day off) and submit the outcome: acknowledged or dispute. A TL on shift may close any open CTL."
  },
  {
    "path": "disputes",
    "title": "Disputes",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Disputes team leads raised at the CTL: record the weekly meeting outcome, or escalate to Mohamed."
  },
  {
    "path": "calibration",
    "title": "Calibration",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Each auditor scored against the team lead reference on the same tickets, and the auditor trend over time."
  },
  {
    "path": "kb-gaps",
    "title": "KB gaps",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Knowledge-base gaps auditors flag on the day of the audit. Auditors add entries; the KB update list marks them added."
  },
  {
    "path": "my-auditor-kpis",
    "title": "My auditor work",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Your own auditor KPIs for a month, the audits you did and any dispute raised on them."
  },
  {
    "path": "quality-analytics",
    "title": "Quality analytics",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Scores by agent, team lead, channel and question; auditor and CTL KPIs."
  },
  {
    "path": "qa-forms",
    "title": "Audit forms",
    "group": "quality",
    "reqs": [],
    "roles": [
      "admin"
    ],
    "purpose": "The audit questions per channel, their weights, and the critical questions that zero an audit."
  },
  {
    "path": "status-validation",
    "title": "Status validation",
    "group": "productivity",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "IDLE time with cases in it, flagged for your review: accept the status it counts as, or revert with a reason."
  },
  {
    "path": "my-status",
    "title": "My status",
    "group": "productivity",
    "reqs": [],
    "roles": [
      "agent"
    ],
    "purpose": "Your flagged IDLE time, raw, suggested and reviewed, and your productivity before and after; dispute a flag."
  },
  {
    "path": "productivity-analytics",
    "title": "Productivity analytics",
    "group": "productivity",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Idle before and after validation, its effect on productivity, and how flags are reviewed."
  },
  {
    "path": "tph",
    "title": "TPH and caps",
    "group": "productivity",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Which channel each agent is on, the cases waiting each hour, and each agent’s touches against their share of them."
  },
  {
    "path": "queue",
    "title": "Queue health",
    "group": "queue",
    "reqs": [
      5
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Every queue now: open work, its age, and how it moved since the last check-in."
  },
  {
    "path": "aging",
    "title": "Aging cases",
    "group": "queue",
    "reqs": [
      11
    ],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Unresolved tickets by age, getting redder the longer they stay open."
  },
  {
    "path": "checkins",
    "title": "Check-ins",
    "group": "queue",
    "reqs": [
      9
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Queue status at 09:30, 13:00, 18:30 and 22:00 Kuwait time."
  },
  {
    "path": "analytics",
    "title": "Analytics",
    "group": "queue",
    "reqs": [
      15
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Inflow by day, week and month: inbound calls, chats and internal escalations."
  },
  {
    "path": "heatmap",
    "title": "Heatmap",
    "group": "queue",
    "reqs": [
      4
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Headcount needed per interval and per shift, by country, with every assumption editable."
  },
  {
    "path": "scheduler",
    "title": "TL scheduler",
    "group": "queue",
    "reqs": [
      10
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Who works which shift, and what each team lead is doing in every hour of the day."
  },
  {
    "path": "agents",
    "title": "Agent performance",
    "group": "people",
    "reqs": [
      1
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Each agent’s productivity and trend, from the V1 productivity engine."
  },
  {
    "path": "one-on-ones",
    "title": "1:1s",
    "group": "people",
    "reqs": [
      3,
      6,
      7
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Schedule and log topic-driven 1:1s. A 1:1 not logged the same day triggers a reminder."
  },
  {
    "path": "tl-tasks",
    "title": "TL tasks",
    "group": "people",
    "reqs": [
      2
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Tasks for team leads with a timeline from start to deadline, progress updates and reminders."
  },
  {
    "path": "meetings",
    "title": "Meetings & BRs",
    "group": "people",
    "reqs": [
      8
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Notes and action items from meetings and business reviews, reviewed at the next one."
  },
  {
    "path": "my-actions",
    "title": "My actions",
    "group": "people",
    "reqs": [
      3,
      8
    ],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "What you agreed to in 1:1s and meetings, and where each stands."
  },
  {
    "path": "notes",
    "title": "Notes",
    "group": "people",
    "reqs": [],
    "roles": [
      "admin"
    ],
    "purpose": "Your private scratchpad: get a thought down now, tag and sort it later, turn it into a task when it is ready."
  },
  {
    "path": "coaching",
    "title": "Coaching signals",
    "group": "people",
    "reqs": [
      3
    ],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Suggest a 1:1 topic for one person, e.g. a QA finding; it reaches their team lead."
  },
  {
    "path": "hard-cases",
    "title": "Hard cases",
    "group": "people",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "A log of difficult cases to coach from, each one linkable to a 1:1."
  },
  {
    "path": "kpi-close",
    "title": "Month-end KPI close",
    "group": "people",
    "reqs": [],
    "roles": [
      "admin"
    ],
    "purpose": "Final agent, team lead and auditor scores from settled data, deductions applied, exceptions with a reason, then the month locked."
  },
  {
    "path": "trackers",
    "title": "Trackers",
    "group": "operations",
    "reqs": [
      16
    ],
    "roles": [
      "admin",
      "tl",
      "agent"
    ],
    "purpose": "Blocked customers, promocodes, operational loss, customer strikes and more, in one place."
  },
  {
    "path": "escalation-matrix",
    "title": "Escalation matrix",
    "group": "operations",
    "reqs": [
      10
    ],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Who to escalate to, for which issue, and after how long, built and kept in one place."
  },
  {
    "path": "tl-performance",
    "title": "TL performance",
    "group": "desk",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "A team lead's week: team scores, responsibilities, projects against expectation, queue hours and mails to answer."
  },
  {
    "path": "kb-tracker",
    "title": "KB tracker",
    "group": "desk",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Knowledge-base updates: when each was asked for, when it was done, and whether it was accurate."
  },
  {
    "path": "kpi-logs",
    "title": "KPI logs",
    "group": "desk",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "What no system records: HR-confirmed behaviour cases, unplanned leaves, and tickets left out of an area's SLA. The scorecard reads them."
  },
  {
    "path": "mail-desk",
    "title": "Mail desk",
    "group": "desk",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "Approval mails to answer in their thread, and MyFatoorah refund updates and chargebacks: who was on queue, who replied and when."
  },
  {
    "path": "fcr",
    "title": "FCR",
    "group": "fcr",
    "reqs": [],
    "roles": [
      "admin",
      "tl"
    ],
    "purpose": "First contact resolution: scoring, raw data, analytics and insights."
  }
];

/** da — rail group order. */
export const GROUP_ORDER: string[] = ["hub","quality","productivity","queue","people","operations","desk","fcr"];

/** Nt — group labels. */
export const GROUP_LABELS: Record<string, string> = {"hub":"Hub","quality":"Quality","productivity":"Productivity","queue":"Queue & Workforce","people":"People & Performance","operations":"Operations & Trackers","fcr":"FCR","desk":"TL desk"};

/** Zt — the default page whose icon represents each group. */
export const GROUP_DEFAULT_PAGE: Record<string, string> = {"hub":"overview","quality":"audit-queue","productivity":"status-validation","queue":"queue","people":"one-on-ones","operations":"trackers","fcr":"fcr","desk":"tl-performance"};

/** Jt — nav tone per group. */
export const GROUP_TONE: Record<string, string> = {"hub":"work","queue":"work","productivity":"work","people":"team","desk":"team","quality":"quality","fcr":"quality","operations":"system"};

/** Zn — the logical apps each group belongs to (title shown in link titles). */
export const APPS: Record<string, { title: string; groups: string[]; server?: string[] | string; scopes?: string[] }> = {"hub":{"title":"CX Helm","groups":["hub"],"server":"*"},"quality":{"title":"CX Helm Quality","groups":["quality"],"server":["QaEngine.js","QaMigrate.js","Quality.js"]},"productivity":{"title":"CX Productivity","groups":["productivity"],"server":["ProdTph.js","ProdValidation.js","ProductivityApp.js","productivity.js"]},"desk":{"title":"CX Helm Desk","groups":["desk"],"server":["KpiLogs.js","MailDesk.js","TlPerformance.js"],"scopes":["https://www.googleapis.com/auth/gmail.send"]},"people":{"title":"CX Helm People","groups":["people"],"server":["Actions.js","Coaching.js","Meetings.js","MigrateV1Tasks.js","Notes.js","OneOnOneDelete.js","OneOnOneReminders.js","OneOnOnes.js","PeopleTriggers.js","Reminders.js","Scorecard.js","Tasks.js"]},"operations":{"title":"CX Helm Operations","groups":["operations"],"server":["Trackers.js"]},"queue":{"title":"CX Helm Queue","groups":["queue"],"server":["AgingHelp.js","Heatmap.js","QueuePages.js","Scheduler.js","TlQueue.js"]},"fcr":{"title":"CX Helm FCR","groups":["fcr"],"server":[]}};

/**
 * bt — this app. In the legacy build each deployment baked in one CC_APP; the
 * unified Next.js deployment serves every group, so the shell derives the app
 * context per route (appForGroup) instead of using this constant.
 */
export const APP_KEY = 'productivity';

/** ie — the umbrella product title (the hub app's). */
export const APP_TITLE = APPS['hub'].title;

/** gs — 40 nav icon inner-SVG fragments, keyed by page path. */
export const NAV_ICONS: Record<string, string> = {"overview":"<path d=\"m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M9 22V12h6v10\"/>","my-day":"<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41\"/>","queue":"<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\"/>","aging":"<path d=\"M5 22h14M5 2h14\"/><path d=\"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22\"/><path d=\"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2\"/>","checkins":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m9 12 2 2 4-4\"/>","analytics":"<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"M18 17V9M13 17V5M8 17v-3\"/>","scheduler":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M16 2v4M8 2v4M3 10h18M8 15h3M13 15h3\"/>","heatmap":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18M3 15h18M9 3v18M15 3v18\"/>","agents":"<path d=\"m22 7-8.5 8.5-5-5L2 17\"/><path d=\"M16 7h6v6\"/>","one-on-ones":"<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/>","tl-tasks":"<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01\"/>","meetings":"<path d=\"M8 2v4M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/>","trackers":"<path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/>","people-holidays":"<path d=\"M22 12a10.06 10.06 1 0 0-20 0Z\"/><path d=\"M12 12v8a2 2 0 0 0 4 0M12 2v1\"/>","admin":"<path d=\"M20 7h-9M14 17H5\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/>","my-actions":"<path d=\"M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/><path d=\"m9 11 3 3L22 4\"/>","notes":"<path d=\"M12 20h9\"/><path d=\"M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z\"/><path d=\"M4 7h4M4 11h2\"/>","coaching":"<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>","mail-desk":"<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/><path d=\"m22 7-10 6L2 7\"/>","tl-performance":"<path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/>","kpi-logs":"<path d=\"M8 6h13M8 12h13M8 18h13\"/><path d=\"M3 6h.01M3 12h.01M3 18h.01\"/>","audit-queue":"<path d=\"M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2\"/><rect width=\"6\" height=\"4\" x=\"9\" y=\"3\" rx=\"1\"/><path d=\"m9 14 2 2 4-4\"/>","ctls":"<path d=\"M12 20h9\"/><path d=\"M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z\"/>","my-audits":"<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M9 15l2 2 4-4\"/>","quality-analytics":"<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"m19 9-5 5-4-4-3 3\"/>","quality-scores":"<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><rect x=\"7\" y=\"12\" width=\"3\" height=\"5\"/><rect x=\"12\" y=\"8\" width=\"3\" height=\"9\"/><rect x=\"17\" y=\"5\" width=\"3\" height=\"12\"/>","qa-forms":"<path d=\"M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4\"/><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\"/>","disputes":"<path d=\"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><path d=\"M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2\"/>","calibration":"<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>","kb-gaps":"<path d=\"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20\"/><path d=\"M12 7v4M12 15h.01\"/>","my-status":"<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21v-1a6 6 0 0 1 12 0v1M17 11l2 2 4-4\"/>","productivity-analytics":"<path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/>","tph":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18M3 15h18M9 3v18M15 3v18\"/>","status-validation":"<path d=\"M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z\"/><path d=\"M12 6v6l4 2\"/>","hard-cases":"<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4M12 17h.01\"/>","kpi-close":"<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>","escalation-matrix":"<path d=\"m17 11-5-5-5 5M17 18l-5-5-5 5\"/>","fcr":"<path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/><path d=\"m9 11 3 3L22 4\"/>","my-auditor-kpis":"<circle cx=\"12\" cy=\"8\" r=\"7\"/><path d=\"M8.21 13.89 7 23l5-3 5 3-1.21-9.12\"/>","kb-tracker":"<path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/>"};

/**
 * Xt — legacy mapped built page paths to their components. In the Next.js
 * port, route components come from the filesystem; this stays as the marker
 * for which paths are considered 'built'.
 */
export const BUILT_ROUTES: Record<string, string> = {
  'status-validation': 'status-validation',
  'my-status': 'my-status',
  'productivity-analytics': 'productivity-analytics',
  tph: 'tph',
};
