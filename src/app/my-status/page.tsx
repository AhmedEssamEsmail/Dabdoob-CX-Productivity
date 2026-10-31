'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent, Loading } from '@/components/ui'

interface StatusInterval {
  interval_key: string
  status: string
  minutes: number
}

interface DailyLayer {
  id: number
  layer: string
  overall_prod_pct: number | null
}

export default function MyStatusPage() {
  const [intervals, setIntervals] = useState<StatusInterval[]>([])
  const [layers, setLayers] = useState<DailyLayer[]>([])
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
    <div className="p-(--cx-space-4) md:p-(--cx-space-6) max-w-7xl mx-auto">
      <h1 className="text-(length:--cx-text-2xl) md:text-(length:--cx-text-3xl) font-semibold text-foreground mb-(--cx-space-4) md:mb-(--cx-space-6)">
        My Status
      </h1>

      <div className="grid gap-(--cx-space-4) md:gap-(--cx-space-6)">
        <Card>
          <CardHeader>
            <h2 className="text-(length:--cx-text-lg) md:text-(length:--cx-text-xl) font-semibold text-foreground">
              Productivity Score
            </h2>
          </CardHeader>
          <CardContent>
            {layers.length > 0 ? (
              <div className="text-(length:--cx-text-2xl) md:text-(length:--cx-text-3xl) font-bold text-accent">
                {layers[0].overall_prod_pct != null
                  ? `${Math.round(layers[0].overall_prod_pct * 1000) / 10}%`
                  : '—'}
              </div>
            ) : (
              <p className="text-foreground">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-(length:--cx-text-lg) md:text-(length:--cx-text-xl) font-semibold text-foreground">
              Recent Intervals
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {intervals.slice(0, 10).map((interval) => (
                <div key={interval.interval_key} className="flex justify-between p-(--cx-space-3) border-b border-gray-200">
                  <span className="text-foreground text-sm md:text-base">{interval.status}</span>
                  <span className="text-foreground opacity-70 text-sm md:text-base">{interval.minutes} min</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
