'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent, StatusBadge, Loading } from '@/components/ui'

export default function MyStatusPage() {
  const [intervals, setIntervals] = useState<any[]>([])
  const [layers, setLayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/prod/intervals').then(r => r.json()),
      fetch('/api/prod/daily-layers').then(r => r.json())
    ]).then(([ints, lays]) => {
      setIntervals(ints)
      setLayers(lays)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading text="Loading status..." />

  return (
    <div className="p-[var(--cx-space-6)] max-w-7xl mx-auto">
      <h1 className="text-[var(--cx-text-3xl)] font-semibold text-[var(--cx-text-primary)] mb-[var(--cx-space-6)]">
        My Status
      </h1>

      <div className="grid gap-[var(--cx-space-6)]">
        <Card>
          <CardHeader>
            <h2 className="text-[var(--cx-text-xl)] font-semibold text-[var(--cx-text-primary)]">
              Productivity Score
            </h2>
          </CardHeader>
          <CardContent>
            {layers.length > 0 ? (
              <div className="text-[var(--cx-text-3xl)] font-bold text-[var(--cx-accent)]">
                {layers[0].productivity_pct}%
              </div>
            ) : (
              <p className="text-[var(--cx-text-primary)]">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-[var(--cx-text-xl)] font-semibold text-[var(--cx-text-primary)]">
              Recent Intervals
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {intervals.slice(0, 10).map((interval: any) => (
                <div key={interval.interval_key} className="flex justify-between p-[var(--cx-space-3)] border-b border-gray-200">
                  <span className="text-[var(--cx-text-primary)]">{interval.status}</span>
                  <span className="text-[var(--cx-text-primary)] opacity-70">{interval.minutes} min</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
