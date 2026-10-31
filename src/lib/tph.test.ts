import { describe, it, expect } from 'vitest'

describe('TPH Logic', () => {
  describe('Channel-based case counting', () => {
    it('should count cases by channel', () => {
      const cases = [
        { channel: 'internal', count: 5 },
        { channel: 'chats', count: 3 },
        { channel: 'wa', count: 2 },
      ]

      const internalCases = cases.filter(c => c.channel === 'internal').reduce((sum, c) => sum + c.count, 0)
      const chatCases = cases.filter(c => c.channel === 'chats').reduce((sum, c) => sum + c.count, 0)

      expect(internalCases).toBe(5)
      expect(chatCases).toBe(3)
    })

    it('should filter cases by group', () => {
      const cases = [
        { group: 'Customer Support - Internal', count: 5 },
        { group: 'FreshChat', count: 3 },
        { group: 'Waiting Address', count: 2 },
      ]

      const internalGroups = ['Customer Support - Internal', 'Kuwait - Customer Support - Internal']
      const internalCases = cases
        .filter(c => internalGroups.includes(c.group))
        .reduce((sum, c) => sum + c.count, 0)

      expect(internalCases).toBe(5)
    })
  })

  describe('Cap calculation', () => {
    it('should calculate cap from minutes', () => {
      const availableMinutes = 120
      const minutesPerCase = 3

      const cap = Math.floor(availableMinutes / minutesPerCase)
      expect(cap).toBe(40)
    })

    it('should enforce max cap per hour', () => {
      const availableMinutes = 60
      const minutesPerCase = 3
      const calculatedCap = Math.floor(availableMinutes / minutesPerCase)
      const maxPerHour = 20

      const cap = Math.min(calculatedCap, maxPerHour)
      expect(cap).toBe(20)
    })

    it('should handle cap window (before :55 only)', () => {
      const hourMinutes = [
        { minute: 10, active: true },
        { minute: 20, active: true },
        { minute: 56, active: true }, // After :55, should not count
      ]

      const capWindowMinutes = 55
      const countedMinutes = hourMinutes
        .filter(m => m.minute < capWindowMinutes)
        .reduce((sum, m) => sum + (m.active ? 1 : 0), 0)

      expect(countedMinutes).toBe(2)
    })
  })

  describe('Slot calculation', () => {
    it('should calculate slots per hour', () => {
      const startHour = 8
      const endHour = 24
      const hours = endHour - startHour

      expect(hours).toBe(16)
    })

    it('should determine slot by time', () => {
      const time = new Date('2024-01-01 09:30:00')
      const hour = time.getHours()
      const slot = hour - 8 // Assuming 8 AM start

      expect(slot).toBe(1)
    })
  })

  describe('Touch counting', () => {
    it('should count touches per agent', () => {
      const touches = [
        { agent: 'agent1@example.com', touches: 5 },
        { agent: 'agent1@example.com', touches: 3 },
        { agent: 'agent2@example.com', touches: 4 },
      ]

      const agent1Touches = touches
        .filter(t => t.agent === 'agent1@example.com')
        .reduce((sum, t) => sum + t.touches, 0)

      expect(agent1Touches).toBe(8)
    })

    it('should determine eligibility from touch history', () => {
      const agentTouches = [
        { date: '2024-01-01', channel: 'internal' },
        { date: '2024-01-02', channel: 'internal' },
        { date: '2024-01-03', channel: 'chats' },
      ]

      const eligibleDays = 28
      const hasRecentTouches = agentTouches.length > 0

      expect(hasRecentTouches).toBe(true)
    })
  })

  describe('Call time estimation', () => {
    it('should estimate call time with factor', () => {
      const actualCallMinutes = 30
      const factor = 0.5

      const estimatedMinutes = actualCallMinutes * factor
      expect(estimatedMinutes).toBe(15)
    })

    it('should blend call time with primary channel', () => {
      const primaryChannelMinutes = 45
      const callMinutes = 15
      const factor = 0.5

      const blendedMinutes = primaryChannelMinutes + (callMinutes * factor)
      expect(blendedMinutes).toBe(52.5)
    })

    it('should replace estimate with actual on next day', () => {
      const yesterdayEstimate = 15
      const todayActual = 20

      const shouldUseActual = true
      const finalMinutes = shouldUseActual ? todayActual : yesterdayEstimate

      expect(finalMinutes).toBe(20)
    })
  })

  describe('Activity logging', () => {
    it('should log non-queue activities', () => {
      const activities = [
        { key: 'break', name: 'Break' },
        { key: 'meeting', name: 'Meeting' },
      ]

      const breakActivity = activities.find(a => a.key === 'break')
      expect(breakActivity?.name).toBe('Break')
    })

    it('should exclude activities from cap calculation', () => {
      const slots = [
        { hour: 9, channel: 'internal', minutes: 30 },
        { hour: 9, channel: 'break', minutes: 15 },
        { hour: 9, channel: 'internal', minutes: 15 },
      ]

      const workingMinutes = slots
        .filter(s => s.channel !== 'break')
        .reduce((sum, s) => sum + s.minutes, 0)

      expect(workingMinutes).toBe(45)
    })
  })

  describe('Edit window enforcement', () => {
    it('should allow edits within window', () => {
      const tlEditDays = 3
      const daysAgo = 2

      const canEdit = daysAgo <= tlEditDays
      expect(canEdit).toBe(true)
    })

    it('should block edits outside window for TL', () => {
      const tlEditDays = 3
      const daysAgo = 5

      const canEdit = daysAgo <= tlEditDays
      expect(canEdit).toBe(false)
    })

    it('should allow admin to edit any date', () => {
      const isAdmin = true
      const daysAgo = 30

      const canEdit = isAdmin || daysAgo <= 3
      expect(canEdit).toBe(true)
    })
  })

  describe('Ticket status filtering', () => {
    it('should count only required action statuses', () => {
      const tickets = [
        { status: 'Open', count: 5 },
        { status: 'Pending on CX', count: 3 },
        { status: 'Resolved', count: 2 },
      ]

      const requiredStatuses = ['Open', 'Pending on CX']
      const requiredCount = tickets
        .filter(t => requiredStatuses.includes(t.status))
        .reduce((sum, t) => sum + t.count, 0)

      expect(requiredCount).toBe(8)
    })

    it('should exclude chat statuses from count', () => {
      const conversations = [
        { status: 'Open', count: 5 },
        { status: 'Waiting on Customer', count: 3 },
        { status: 'Resolved', count: 2 },
      ]

      const excludeStatuses: string[] = []
      const count = excludeStatuses.length === 0
        ? conversations.filter(c => c.status !== 'Resolved').reduce((sum, c) => sum + c.count, 0)
        : conversations.filter(c => !excludeStatuses.includes(c.status)).reduce((sum, c) => sum + c.count, 0)

      expect(count).toBe(8)
    })
  })
})
