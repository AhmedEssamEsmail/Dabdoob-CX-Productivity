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
    <div className="p-(--cx-space-4) md:p-(--cx-space-6) max-w-7xl mx-auto">
      <h1 className="text-(--cx-text-2xl) md:text-(--cx-text-3xl) font-semibold text-foreground mb-(--cx-space-4) md:mb-(--cx-space-6)">
        My Status
      </h1>

      <div className="grid gap-(--cx-space-4) md:gap-(--cx-space-6)">
        <Card>
          <CardHeader>
            <h2 className="text-(--cx-text-lg) md:text-(--cx-text-xl) font-semibold text-foreground">
              Productivity Score
            </h2>
          </CardHeader>
          <CardContent>
            {layers.length > 0 ? (
              <div className="text-(--cx-text-2xl) md:text-(--cx-text-3xl) font-bold text-accent">
                {layers[0].productivity_pct}%
              </div>
            ) : (
              <p className="text-foreground">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-(--cx-text-lg) md:text-(--cx-text-xl) font-semibold text-foreground">
              Recent Intervals
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {intervals.slice(0, 10).map((interval: any) => (
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
