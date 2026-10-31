import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cx-focus) disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary: 'bg-accent text-(--cx-accent-ink) hover:bg-(--cx-accent-hover)',
    secondary: 'bg-(--cx-status-neutral-bg) text-(--cx-status-neutral-fg) hover:bg-(--cx-status-neutral-edge)',
    outline: 'border-2 border-(--cx-accent) text-accent hover:bg-(--cx-accent-soft)',
  }

  const sizes = {
    sm: 'h-8 px-3 text-sm rounded-(--cx-radius-control)',
    md: 'h-10 px-4 text-base rounded-(--cx-radius-control)',
    lg: 'h-12 px-6 text-lg rounded-(--cx-radius-object)',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      style={{ minHeight: 'var(--cx-target)' }}
      {...props}
    >
      {children}
    </button>
  )
}
