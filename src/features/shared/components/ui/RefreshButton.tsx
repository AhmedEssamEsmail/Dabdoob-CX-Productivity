'use client'

import { useState } from 'react'
import { Button } from './Button'
import { usePoll } from '../../lib/use-poll'

type RefreshResult = {
  refreshed?: boolean
  synced_to?: string
  message?: string
  retryInS?: number
}

export type RefreshButtonProps = {
  refresh: () => Promise<RefreshResult>
  onDone: () => void
  btnClassName?: string
}

const kwTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const hm = (t: string) => kwTime.format(new Date(t))

export function RefreshButton({ refresh, onDone, btnClassName }: RefreshButtonProps) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now)
  usePoll(until > now ? 1000 : null, () => setNow(Date.now()), { immediate: false })
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  const go = () => {
    setBusy(true)
    setMsg('')
    refresh().then(
      (c) => {
        setBusy(false)
        const o = c.refreshed && c.synced_to ? `Freshdesk changes up to ${hm(c.synced_to)} Kuwait time.` : ''
        setMsg((o + ' ' + (c.message || '')).replace(/\s*Try again in \d+ s\.$/, '').trim())
        if (c.retryInS) {
          setUntil(Date.now() + c.retryInS * 1000)
          setNow(Date.now())
        }
        if (c.refreshed) onDone()
      },
      (c) => {
        setBusy(false)
        setMsg(c.message)
      },
    )
  }
  return (
    <span className="cx-refresh">
      <Button className={btnClassName} disabled={busy || left > 0} aria-busy={busy} onClick={go}>
        {busy ? 'Refreshing…' : left > 0 ? `Refresh again in ${left} s` : 'Refresh now'}
      </Button>
      {msg ? (
        <span className="cx-section__hint" role="status">
          {msg}
        </span>
      ) : null}
    </span>
  )
}
