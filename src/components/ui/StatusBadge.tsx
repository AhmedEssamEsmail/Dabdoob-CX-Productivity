import React from 'react'

type StatusType = 'neutral' | 'info' | 'success' | 'warning' | 'error'

interface StatusBadgeProps {
  type: StatusType
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ type, children, className = '' }: StatusBadgeProps) {
  const styles = {
    neutral: {
      bg: 'bg-[var(--cx-status-neutral-bg)]',
      fg: 'text-[var(--cx-status-neutral-fg)]',
      edge: 'border-[var(--cx-status-neutral-edge)]',
    },
    info: {
      bg: 'bg-[var(--cx-status-info-bg)]',
      fg: 'text-[var(--cx-status-info-fg)]',
      edge: 'border-[var(--cx-status-info-edge)]',
    },
    success: {
      bg: 'bg-[var(--cx-status-ok-bg)]',
      fg: 'text-[var(--cx-status-ok-fg)]',
      edge: 'border-[var(--cx-status-ok-edge)]',
    },
    warning: {
      bg: 'bg-[var(--cx-status-warn-bg)]',
      fg: 'text-[var(--cx-status-warn-fg)]',
      edge: 'border-[var(--cx-status-warn-edge)]',
    },
    error: {
      bg: 'bg-[var(--cx-status-bad-bg)]',
      fg: 'text-[var(--cx-status-bad-fg)]',
      edge: 'border-[var(--cx-status-bad-edge)]',
    },
  }

  const style = styles[type]

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-[var(--cx-radius-control)] text-sm font-medium border ${style.bg} ${style.fg} ${style.edge} ${className}`}
    >
      {children}
    </span>
  )
}
