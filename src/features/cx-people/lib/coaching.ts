/**
 * Coaching.js — the Enablement specialist (or a TL / admin) suggests a 1:1
 * topic for one person, e.g. "QA audit A-1234 scored 62% on refunds". It lands
 * in the people_signals tab, which pwSuggestTopics_ reads, so the person's TL
 * sees it as a suggested topic in their next 1:1, and gets a pop-up now. The
 * page shows each signal as waiting or picked up (a later 1:1 with that person
 * covered the topic).
 */

import { normEmail_, pwMs_, pwKwDate_, pwToday_ } from '@/features/shared/lib/adapters'
import { newId, appendRows } from '@/features/shared/platform/repo'
import { readRows } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { raisePopup } from '@/features/shared/platform/popups'
import { pwTopicLibrary_ } from './one-on-ones'

export const PW_SIGNAL_TOPICS = ['quality', 'productivity', 'attendance', 'development', 'recognition']

export function pwCanSignal_(user: { role: string; specialist?: boolean }): boolean {
  return user.role === 'admin' || user.role === 'tl' || user.specialist === true
}

/** coachingPage: people list, topic library, and the signals the caller may see. */
export async function coachingPage() {
  const user = await requireRole(['admin', 'tl', 'agent'])
  if (!pwCanSignal_(user)) throw new Error('Coaching signals are for Enablement, team leads and admins.')
  const dir = await pwDirectory()
  const logs = await safeRows('one_on_one_logs')
  const topics = await safeRows('one_on_one_topics')
  const people = Object.keys(dir.by)
    .map((k) => dir.by[k])
    .filter((p) => p.active && (p.role === 'agent' || p.role === 'tl') && p.email !== user.email)
    .map((p) => ({
      email: p.email,
      name: p.name,
      managerName: dir.managerOf(p.email) ? dir.name(dir.managerOf(p.email)!) : '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const lib = pwTopicLibrary_('agent')
    .filter((t) => PW_SIGNAL_TOPICS.indexOf(t.id) !== -1)
    .map((t) => ({ id: t.id, label: t.label }))
  const signals = (await safeRows('people_signals'))
    .filter((r) => user.role === 'admin' || normEmail_(r.submitted_by) === user.email)
    .sort((a, b) => pwMs_(b.signal_date) - pwMs_(a.signal_date))
    .slice(0, 60)
    .map((r) => {
      const at = pwMs_(r.signal_date)
      const picked = logs
        .filter(
          (l) =>
            normEmail_(l.report_email) === normEmail_(r.email) &&
            pwMs_(l.held_at) >= at &&
            topics.some(
              (t) => String(t.log_id) === String(l.log_id) && String(t.topic) === String(r.topic) && !t.skipped_reason,
            ),
        )
        .sort((a, b) => pwMs_(a.held_at) - pwMs_(b.held_at))[0]
      return {
        signalId: String(r.signal_id),
        email: normEmail_(r.email),
        name: dir.name(String(r.email)),
        topic: String(r.topic),
        reason: String(r.reason || ''),
        date: pwKwDate_(at),
        pickedUpOn: picked ? pwKwDate_(picked.held_at) : '',
        pickedUpBy: picked ? dir.name(String(picked.manager_email)) : '',
      }
    })
  return { people, topics: lib, signals }
}

/** coachingSignal: writes one people_signals row and pops it at the person's TL. */
export async function coachingSignal(input: Record<string, unknown>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  if (!pwCanSignal_(user)) throw new Error('Coaching signals are for Enablement, team leads and admins.')
  await assertWritable()
  const i = input || {}
  const dir = await pwDirectory()
  const email = normEmail_(i.email)
  const p = dir.person(email)
  if (!p || !p.active) throw new Error('Choose an active person from the roster.')
  const topic = String(i.topic || '')
  if (PW_SIGNAL_TOPICS.indexOf(topic) === -1) throw new Error('Choose a topic.')
  const reason = String(i.reason || '').trim().slice(0, 500)
  if (!reason) throw new Error('Say what you saw, e.g. the audit ID and score, so the TL can raise it.')
  const rows = await appendRows(
    'people_signals',
    [
      {
        signal_id: newId('SIG'),
        email,
        topic,
        reason,
        signal_date: new Date().toISOString(),
        source: user.specialist ? 'enablement' : user.role,
      },
    ],
    user.email,
  )
  const row = rows[0]
  const mgr = dir.managerOf(email)
  if (mgr && mgr !== user.email) {
    await raisePopup(
      {
        recipient: mgr,
        kind: 'coaching_signal',
        ref: String(row.signal_id),
        title: user.name + ' suggests a 1:1 topic for ' + p.name,
        body: reason + ' It is in the suggested topics of your next 1:1 with ' + p.name + '.',
        link: '#/one-on-ones',
      },
      user.email,
    )
  }
  return { signalId: String(row.signal_id), email, name: p.name, topic, reason, date: pwToday_(), pickedUpOn: '', pickedUpBy: '' }
}

async function safeRows(name: string): Promise<Record<string, unknown>[]> {
  try {
    return await readRows(name)
  } catch {
    return []
  }
}
