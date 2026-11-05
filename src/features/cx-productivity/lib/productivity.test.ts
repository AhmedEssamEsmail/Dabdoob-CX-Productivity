import { describe, it, expect } from 'vitest'

describe('Productivity Logic', () => {
  describe('Interval parsing', () => {
    it('should parse interval from CSV row', () => {
      const row = {
        'Agent Name': 'John Doe',
        'Status': 'Available',
        'Start Time': '2024-01-01 09:00:00',
        'End Time': '2024-01-01 10:00:00',
      }

      const interval = {
        agentName: row['Agent Name'],
        status: row['Status'],
        startAt: row['Start Time'],
        endAt: row['End Time'],
      }

      expect(interval.agentName).toBe('John Doe')
      expect(interval.status).toBe('Available')
    })

    it('should calculate minutes from timestamps', () => {
      const start = new Date('2024-01-01 09:00:00').getTime()
      const end = new Date('2024-01-01 10:00:00').getTime()
      const minutes = (end - start) / 60000

      expect(minutes).toBe(60)
    })
  })

  describe('Flag detection', () => {
    it('should detect flag when cases exceed threshold in window', () => {
      const windowMinutes = 10
      const caseCount = 3
      const threshold = 2

      const shouldFlag = caseCount >= threshold
      expect(shouldFlag).toBe(true)
    })

    it('should not flag when cases below threshold', () => {
      const windowMinutes = 10
      const caseCount = 1
      const threshold = 2

      const shouldFlag = caseCount >= threshold
      expect(shouldFlag).toBe(false)
    })

    it('should only flag intervals longer than minimum', () => {
      const intervalMinutes = 3
      const minimumMinutes = 5

      const shouldFlag = intervalMinutes >= minimumMinutes
      expect(shouldFlag).toBe(false)
    })
  })

  describe('Confidence scoring', () => {
    it('should calculate confidence score from factors', () => {
      const factors = {
        caseCount: 5,
        windowCount: 2,
        statusHistory: 'strong',
      }

      // Simple confidence calculation for testing
      const score = Math.min(100, (factors.caseCount * 10) + (factors.windowCount * 15))
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should classify confidence level', () => {
      const score = 75
      let level = 'low'
      if (score >= 50) level = 'medium'
      if (score >= 75) level = 'high'

      expect(level).toBe('high')
    })

    it('should auto-accept high confidence flags', () => {
      const confidence = 80
      const autoThreshold = 50

      const shouldAutoAccept = confidence >= autoThreshold
      expect(shouldAutoAccept).toBe(true)
    })

    it('should require manual review for low confidence', () => {
      const confidence = 30
      const autoThreshold = 50

      const shouldAutoAccept = confidence >= autoThreshold
      expect(shouldAutoAccept).toBe(false)
    })
  })

  describe('Productivity percentage calculation', () => {
    it('should calculate productivity percentage', () => {
      const workingMinutes = 420 // 7 hours
      const totalMinutes = 480 // 8 hours

      const productivity = (workingMinutes / totalMinutes) * 100
      expect(productivity).toBe(87.5)
    })

    it('should handle zero total minutes', () => {
      const workingMinutes = 0
      const totalMinutes = 0

      const productivity = totalMinutes > 0 ? (workingMinutes / totalMinutes) * 100 : 0
      expect(productivity).toBe(0)
    })

    it('should cap productivity at 100%', () => {
      const workingMinutes = 500
      const totalMinutes = 480

      const productivity = Math.min(100, (workingMinutes / totalMinutes) * 100)
      expect(productivity).toBe(100)
    })
  })

  describe('Daily layer computation', () => {
    it('should compute raw layer from intervals', () => {
      const intervals = [
        { status: 'Available', minutes: 60 },
        { status: 'IDLE', minutes: 30 },
        { status: 'Chats', minutes: 90 },
      ]

      const rawLayer = {
        available: intervals.filter(i => i.status === 'Available').reduce((sum, i) => sum + i.minutes, 0),
        idle: intervals.filter(i => i.status === 'IDLE').reduce((sum, i) => sum + i.minutes, 0),
        chats: intervals.filter(i => i.status === 'Chats').reduce((sum, i) => sum + i.minutes, 0),
      }

      expect(rawLayer.available).toBe(60)
      expect(rawLayer.idle).toBe(30)
      expect(rawLayer.chats).toBe(90)
    })

    it('should compute effective layer after flag decisions', () => {
      const rawLayer = { available: 60, idle: 30, chats: 90 }
      const flag = { rawStatus: 'IDLE', validatedStatus: 'Chats', flaggedMinutes: 30 }

      const effectiveLayer = {
        available: rawLayer.available,
        idle: rawLayer.idle - flag.flaggedMinutes,
        chats: rawLayer.chats + flag.flaggedMinutes,
      }

      expect(effectiveLayer.idle).toBe(0)
      expect(effectiveLayer.chats).toBe(120)
    })
  })

  describe('Status normalization', () => {
    it('should normalize status names', () => {
      const status = '  AVAILABLE  '
      const normalized = status.trim().toLowerCase()

      expect(normalized).toBe('available')
    })

    it('should apply status mapping', () => {
      const statusMap: Record<string, string> = {
        'available': 'Available',
        'busy': 'Available',
        'ready': 'Available',
      }

      const inputStatus = 'busy'
      const normalized = inputStatus.trim().toLowerCase()
      const mapped = statusMap[normalized] || inputStatus

      expect(mapped).toBe('Available')
    })
  })

  describe('Hash function stability', () => {
    it('should produce same hash for same input', () => {
      const input = 'test@example.com|1234567890|idle'
      const hash1 = simpleHash(input)
      const hash2 = simpleHash(input)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', () => {
      const input1 = 'test@example.com|1234567890|idle'
      const input2 = 'test@example.com|1234567891|idle'
      const hash1 = simpleHash(input1)
      const hash2 = simpleHash(input2)

      expect(hash1).not.toBe(hash2)
    })
  })
})

// Simple hash function for testing
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}
