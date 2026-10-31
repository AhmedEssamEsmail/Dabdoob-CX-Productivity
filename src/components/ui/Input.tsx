import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-[var(--cx-text-primary)]">
          {label}
        </label>
      )}
      <input
        className={`px-3 py-2 rounded-[var(--cx-radius-control)] border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--cx-focus)] focus:border-transparent ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <span className="text-sm text-[var(--cx-status-bad-fg)]">
          {error}
        </span>
      )}
    </div>
  )
}
