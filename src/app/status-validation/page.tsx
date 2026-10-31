'use client'

import { useEffect, useState } from 'react'

export default function StatusValidationPage() {
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/prod/flags')
      .then(res => res.json())
      .then(data => {
        setFlags(data.flags || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load flags:', err)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Status Validation</h1>
      <div className="bg-white rounded shadow p-4">
        {flags.length === 0 ? (
          <p>No flags to review</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left p-2">Agent</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-t">
                  <td className="p-2">{flag.agent_email}</td>
                  <td className="p-2">{flag.flag_type}</td>
                  <td className="p-2">{flag.status}</td>
                  <td className="p-2">{flag.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
