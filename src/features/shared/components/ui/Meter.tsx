import type { HTMLAttributes } from 'react'

export type MeterProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'aria-valuemax' | 'aria-valuemin' | 'aria-valuenow' | 'role'
> & {
  value: number
  max?: number
  label: string
  tone?: string
}

export function Meter({ value, max = 100, label, tone, className, ...props }: MeterProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div
      {...props}
      className={['cx-meter', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      data-tone={tone}
    >
      <span aria-hidden="true" className="cx-meter-fill" style={{ width: `${percent}%` }} />
    </div>
  )
}
