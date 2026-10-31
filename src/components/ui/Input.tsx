import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export function Input({ label, error, helperText, className = '', id, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const errorId = error ? `${inputId}-error` : undefined
  const helperId = helperText ? `${inputId}-helper` : undefined

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`px-3 py-2 rounded-(--cx-radius-control) border border-gray-300 focus:outline-none focus:ring-2 focus:ring-(--cx-focus) focus:border-transparent ${error ? 'border-red-500' : ''} ${className}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={errorId || helperId}
        aria-required={props.required}
        {...props}
      />
      {helperText && !error && (
        <span id={helperId} className="text-sm text-foreground opacity-70">
          {helperText}
        </span>
      )}
      {error && (
        <span id={errorId} className="text-sm text-(--cx-status-bad-fg)" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
