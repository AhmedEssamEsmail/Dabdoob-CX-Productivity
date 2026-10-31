'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent, Table, TableHeader, TableRow, TableHead, TableCell, StatusBadge, Button, Loading, Input } from '@/components/ui'

interface TphDay {
  date: string
  agent_email: string
  slots_json: Record<string, any>
  sources_json: Record<string, any>
}

interface TphCase {
  date: string
  source: string
  cases_json: Record<string, number>
}

interface TphTask {
  task_id: string
  date: string
  agent_email: string
  channel: string
  start: string
  end: string
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8) // 8:00 to 23:00
const CHANNELS = [
  { key: 'internal', name: 'Internal', color: 'var(--cx-status-info-bg)' },
  { key: 'chats', name: 'Chats', color: 'var(--cx-status-ok-bg)' },
  { key: 'wa', name: 'Waiting Address', color: 'var(--cx-status-warn-bg)' },
  { key: 'calls', name: 'Inbound Calls', color: 'var(--cx-status-bad-bg)' },
  { key: 'off', name: 'Off Shift', color: 'var(--cx-status-neutral-bg)' },
]

export default function TphGridPage() {
  const [days, setDays] = useState<TphDay[]>([])
  const [cases, setCases] = useState<TphCase[]>([])
  const [tasks, setTasks] = useState<TphTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)

  useEffect(() => {
    // Set default date on client side only
    if (!selectedDate) {
      setSelectedDate(new Date().toISOString().split('T')[0])
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch(`/api/tph/days?date=${selectedDate}`).then(r => r.json()),
      fetch(`/api/tph/cases?date=${selectedDate}`).then(r => r.json()),
      fetch(`/api/tph/tasks?date=${selectedDate}`).then(r => r.json()),
    ]).then(([daysData, casesData, tasksData]) => {
      setDays(daysData.days || [])
      setCases(casesData.cases || [])
      setTasks(tasksData.tasks || [])
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load TPH data:', err)
      setLoading(false)
    })
  }, [selectedDate])

  if (loading) return <Loading text="Loading TPH grid..." />

  const getSlotData = (hour: number, channel: string) => {
    const slotKey = `${hour.toString().padStart(2, '0')}:00`
    const dayData = days.find(d => d.date === selectedDate)
    if (!dayData) return null

    const slots = dayData.slots_json || {}
    return slots[channel]?.[slotKey] || null
  }

  const getCaseCount = (channel: string, hour: number) => {
    const caseData = cases.find(c => c.date === selectedDate && c.source === channel)
    if (!caseData) return 0

    const caseMap = caseData.cases_json || {}
    return caseMap[`${hour.toString().padStart(2, '0')}:00`] || 0
  }

  const isCapReached = (channel: string, hour: number) => {
    const slotData = getSlotData(hour, channel)
    if (!slotData) return false
    return slotData.minutes >= slotData.cap
  }

  const handleCellClick = (hour: number, channel: string) => {
    setSelectedHour(hour)
    setSelectedChannel(channel)
  }

  const handleLogActivity = (hour: number, channel: string) => {
    // This would open a modal or form to log activity
    console.log(`Log activity for ${channel} at ${hour}:00`)
  }

  return (
    <div className="p-(--cx-space-4) md:p-(--cx-space-6) max-w-full mx-auto">
      <div className="flex justify-between items-center mb-(--cx-space-4) md:mb-(--cx-space-6)">
        <h1 className="text-(--cx-text-2xl) md:text-(--cx-text-3xl) font-semibold text-foreground">
          TPH Grid
        </h1>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-auto"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-(--cx-text-lg) md:text-(--cx-text-xl) font-semibold text-foreground">
            Hourly Time Slots - {new Date(selectedDate).toLocaleDateString()}
          </h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-(--cx-space-4) md:mx-0">
            <div className="min-w-300 px-(--cx-space-4) md:px-0">
              <Table caption="TPH hourly time slots by channel">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10">Hour</TableHead>
                    {CHANNELS.map(channel => (
                      <TableHead key={channel.key} className="min-w-[150px]">
                        {channel.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <tbody>
                  {HOURS.map(hour => (
                    <TableRow key={hour}>
                      <TableCell className="sticky left-0 bg-white font-medium">
                        {hour.toString().padStart(2, '0')}:00
                      </TableCell>
                      {CHANNELS.map(channel => {
                        const slotData = getSlotData(hour, channel.key)
                        const caseCount = getCaseCount(channel.key, hour)
                        const capReached = isCapReached(channel.key, hour)

                        return (
                          <TableCell
                            key={channel.key}
                            className={`
                              cursor-pointer hover:bg-(--cx-accent-soft) transition-colors
                              ${capReached ? 'bg-(--cx-status-warn-bg)' : ''}
                            `}
                          >
                            <div
                              className="flex flex-col gap-1"
                              onClick={() => handleCellClick(hour, channel.key)}
                            >
                              {slotData ? (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">{slotData.minutes} min</span>
                                    {capReached && (
                                      <StatusBadge type="warning">CAP</StatusBadge>
                                    )}
                                  </div>
                                  {caseCount > 0 && (
                                    <div className="text-xs text-foreground opacity-70">
                                      {caseCount} cases
                                    </div>
                                  )}
                                </>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleLogActivity(hour, channel.key)
                                  }}
                                  className="text-sm text-accent hover:underline"
                                >
                                  Log Activity
                                </button>
                              )}
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedHour !== null && selectedChannel && (
        <Card className="mt-(--cx-space-6)">
          <CardHeader>
            <h3 className="text-(--cx-text-lg) font-semibold text-foreground">
              Details: {selectedChannel} at {selectedHour.toString().padStart(2, '0')}:00
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Minutes</label>
                <Input type="number" placeholder="Enter minutes" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Cases</label>
                <Input type="number" placeholder="Enter case count" />
              </div>
              <div className="flex gap-2">
                <Button variant="primary">Save</Button>
                <Button variant="outline" onClick={() => {
                  setSelectedHour(null)
                  setSelectedChannel(null)
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-(--cx-space-6)">
        <CardHeader>
          <h3 className="text-(--cx-text-lg) font-semibold text-foreground">
            Recent Tasks
          </h3>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-foreground">No tasks logged</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 10).map((task) => (
                <div key={task.task_id} className="flex justify-between p-(--cx-space-3) border-b border-gray-200">
                  <span className="text-foreground">{task.channel}</span>
                  <span className="text-foreground opacity-70">
                    {task.start} - {task.end}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
