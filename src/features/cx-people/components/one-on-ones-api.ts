'use client'
 
/* I — the one-on-ones + tasks facade — extracted from one-on-ones-page.tsx (verbatim move, S13-03). */
/* I — the one-on-ones + tasks facade. */
import { fetchJson } from './shared'

export const api = {
  oneOnOnesPage: () => fetchJson('/api/people/one-on-ones'),
  oneOnOnesStart: (reportEmail: string) =>
    fetchJson(`/api/people/one-on-ones/start?reportEmail=${encodeURIComponent(reportEmail)}`),
  oneOnOnesSubmit: (record: Record<string, unknown>) => fetchJson('/api/people/one-on-ones', record),
  oneOnOnesGetLog: (logId: string) =>
    fetchJson(`/api/people/one-on-ones/log?logId=${encodeURIComponent(logId)}`),
  oneOnOnesProductivity: (reportEmail: string, from: string, to: string) =>
    fetchJson(
      `/api/people/one-on-ones/productivity?reportEmail=${encodeURIComponent(reportEmail)}&from=${from}&to=${to}`
    ),
  oneOnOnesSchedule: (reportEmail: string, when: string, durationMin: number) =>
    fetchJson('/api/people/one-on-ones/schedule', { op: 'book', reportEmail, when, durationMin }),
  oneOnOnesReschedule: (scheduleId: string, when: string, reason: string) =>
    fetchJson('/api/people/one-on-ones/schedule', { op: 'reschedule', scheduleId, when, reason }),
  oneOnOnesMarkNotHeld: (scheduleId: string, reason: string, newWhen: string) =>
    fetchJson('/api/people/one-on-ones/schedule', { op: 'not_held', scheduleId, reason, newWhen }),
  oneOnOnesDeletePreview: (logId: string) =>
    fetchJson('/api/people/one-on-ones/delete', { op: 'preview', logId }),
  oneOnOnesDeleteLog: (logId: string, reason: string) =>
    fetchJson('/api/people/one-on-ones/delete', { op: 'log', logId, reason }),
  oneOnOnesDeleteBooking: (scheduleId: string, reason: string) =>
    fetchJson('/api/people/one-on-ones/delete', { op: 'booking', scheduleId, reason }),
  oneOnOnesRestore: (type: string, id: string) =>
    fetchJson('/api/people/one-on-ones/restore', { type, id }),
  tasksCreate: (input: Record<string, unknown>) => fetchJson('/api/people/tasks', input),
  tasksSetStatus: (actionId: string, status: string, info: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/status', { actionId, status, info }),
  tasksEditDetails: (actionId: string, patch: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/details', { actionId, ...patch }),
  tasksPostMilestone: (actionId: string, milestone: Record<string, unknown>) =>
    fetchJson('/api/people/tasks/milestone', { actionId, ...milestone }),
}