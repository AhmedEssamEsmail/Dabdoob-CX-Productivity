import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function Loading({ size = 'md', text = 'Loading...' }: LoadingProps) {
  const sizes = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`relative ${sizes[size]} flex items-center justify-center`}>
        {/* Simple CSS loader matching original design */}
        <div className="absolute inset-0 border-4 border-[var(--cx-status-neutral-bg)] rounded-full"></div>
        <div className="absolute inset-0 border-4 border-[var(--cx-accent)] rounded-full border-t-transparent animate-spin"></div>
      </div>
      {text && (
        <p className="text-[var(--cx-text-primary)] font-medium">
          {text}
        </p>
      )}
    </div>
  )
}

// Boot splash component for initial page load
export function BootSplash() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(900px_500px_at_8%_-10%,var(--cx-bg-blue)_0,transparent_60%),radial-gradient(800px_500px_at_100%_0,var(--cx-bg-pink)_0,transparent_55%),var(--cx-bg-primary)]">
      <Loading size="lg" text="Loading CX Helm Productivity…" />
    </div>
  )
}
