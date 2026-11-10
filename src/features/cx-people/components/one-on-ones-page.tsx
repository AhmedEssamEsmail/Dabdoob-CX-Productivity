'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy 1:1s page (one-on-ones.closure.js symbol jl,
 * with Gl/Ql/Yl/Vl/Kl/Xl/Jl/Zl/ls/ea and the oo-* context widgets). */
import { useEffect, useState } from 'react'
import { useSe } from './shared'
import { PwShell, PwLate, PwSkel, hashParam, routeOf } from './pw'
import { Tabs } from '@/features/shared/components/ui'
import { api } from './one-on-ones-api'
import { BookedDue, LogTab, Records } from './one-on-ones-views'

/* ------------------------------------------------------- jl — page */
export function OneOnOnesPage({ route }: { route: { title: string; purpose?: string } }) {
  const { data, error, reload } = useSe('people.1on1', () => api.oneOnOnesPage())
  const [tab, setTab] = useState('schedule')
  const [initial, setInitial] = useState<any>(null)
  useEffect(() => {
    if (!data) return
    /* ?schedule=<id> opens that slot on the log tab; ?log=<id> goes to Records.
     * Deferred so the state updates are not synchronous in the effect body. */
    queueMicrotask(() => {
      const sched = hashParam('schedule')
      const hit = sched ? [...data.missed, ...data.upcoming].find((r: any) => r.scheduleId === sched) : undefined
      if (hit) {
        setInitial({ email: hit.reportEmail, scheduleId: hit.scheduleId })
        setTab('log')
      }
      if (hashParam('log')) setTab('records')
    })
  }, [data])
  const startLog = (email: string, scheduleId?: string) => {
    setInitial({ email, scheduleId })
    setTab('log')
    window.scrollTo(0, 0)
  }
  const body = error ? (
    <PwLate message={error} retry={reload} />
  ) : data ? (
    tab === 'schedule' ? (
      <BookedDue data={data} reload={reload} startLog={startLog} />
    ) : tab === 'log' ? (
      <LogTab
        data={data}
        initial={initial}
        onDone={() => {
          setInitial(null)
          void Promise.resolve(reload()).then(() => setTab('records'))
        }}
      />
    ) : (
      <Records
        logs={data.logs}
        deleted={data.deleted ?? []}
        me={data.me}
        reload={reload}
        initialOpen={hashParam('log') ?? ''}
      />
    )
  ) : (
    <PwSkel />
  )
  const tabs = [
    {
      id: 'schedule',
      label: (
        <>
          Booked & due
          {data?.missed.length ? <span className="pw-count">{data.missed.length}</span> : null}
        </>
      ),
      panel: body,
    },
    { id: 'log', label: 'Log a 1:1', panel: body },
    { id: 'records', label: 'Records', panel: body },
  ]
  return (
    <PwShell route={routeOf('one-on-ones', route)}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} aria-label="One-to-ones" />
    </PwShell>
  )
}
