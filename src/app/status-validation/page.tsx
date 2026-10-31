'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent, Table, TableHeader, TableRow, TableHead, TableCell, StatusBadge, Button, Loading } from '@/components/ui'

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

  if (loading) return <Loading text="Loading flags..." />

  return (
    <div className="p-(--cx-space-4) md:p-(--cx-space-6) max-w-7xl mx-auto">
      <h1 className="text-(--cx-text-2xl) md:text-(--cx-text-3xl) font-semibold text-foreground mb-(--cx-space-4) md:mb-(--cx-space-6)">
        Status Validation
      </h1>

      <Card>
        <CardHeader>
          <h2 className="text-(--cx-text-lg) md:text-(--cx-text-xl) font-semibold text-foreground">
            Productivity Flags
          </h2>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <p className="text-foreground">No flags to review</p>
          ) : (
            <div className="overflow-x-auto -mx-(--cx-space-4) md:mx-0">
              <div className="min-w-200 px-(--cx-space-4) md:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <tbody>
                    {flags.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell>{flag.agent_email}</TableCell>
                        <TableCell>{flag.flag_type}</TableCell>
                        <TableCell>
                          <StatusBadge type={flag.status === 'pending' ? 'warning' : flag.status === 'accepted' ? 'success' : 'error'}>
                            {flag.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>{flag.confidence}%</TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" variant="primary">Accept</Button>
                            <Button size="sm" variant="outline">Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
