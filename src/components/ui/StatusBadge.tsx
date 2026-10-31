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
      bg: 'bg-(--cx-status-neutral-bg)',
      fg: 'text-(--cx-status-neutral-fg)',
      edge: 'border-(--cx-status-neutral-edge)',
    },
    info: {
      bg: 'bg-(--cx-status-info-bg)',
      fg: 'text-(--cx-status-info-fg)',
      edge: 'border-(--cx-status-info-edge)',
    },
    success: {
      bg: 'bg-(--cx-status-ok-bg)',
      fg: 'text-(--cx-status-ok-fg)',
      edge: 'border-(--cx-status-ok-edge)',
    },
    warning: {
      bg: 'bg-(--cx-status-warn-bg)',
      fg: 'text-(--cx-status-warn-fg)',
      edge: 'border-(--cx-status-warn-edge)',
    },
    error: {
      bg: 'bg-(--cx-status-bad-bg)',
      fg: 'text-(--cx-status-bad-fg)',
      edge: 'border-(--cx-status-bad-edge)',
    },
  }

  const style = styles[type]

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-(--cx-radius-control) text-sm font-medium border ${style.bg} ${style.fg} ${style.edge} ${className}`}
    >
      {children}
    </span>
  )
}
