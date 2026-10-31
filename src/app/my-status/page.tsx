'use client'

import { useState, useEffect } from 'react'

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

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Status</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Productivity Score</h2>
          {layers.length > 0 && (
            <div className="text-4xl font-bold text-blue-600">
              {layers[0].productivity_pct}%
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Recent Intervals</h2>
          <div className="space-y-2">
            {intervals.slice(0, 10).map((interval: any) => (
              <div key={interval.interval_key} className="flex justify-between p-2 border-b">
                <span>{interval.status}</span>
                <span className="text-gray-600">{interval.minutes} min</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
