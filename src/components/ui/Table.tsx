import React from 'react'

interface TableProps {
  children: React.ReactNode
  className?: string
  caption?: string
}

export function Table({ children, className = '', caption }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`} role="region" aria-label={caption}>
      <table className="w-full border-collapse">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

interface TableHeaderProps {
  children: React.ReactNode
  className?: string
}

export function TableHeader({ children, className = '' }: TableHeaderProps) {
  return (
    <thead className={`bg-gray-50 ${className}`}>
      {children}
    </thead>
  )
}

interface TableRowProps {
  children: React.ReactNode
  className?: string
}

export function TableRow({ children, className = '' }: TableRowProps) {
  return (
    <tr className={`border-t border-gray-200 hover:bg-gray-50 ${className}`}>
      {children}
    </tr>
  )
}

interface TableHeadProps {
  children: React.ReactNode
  className?: string
  scope?: 'col' | 'row'
}

export function TableHead({ children, className = '', scope = 'col' }: TableHeadProps) {
  return (
    <th
      scope={scope}
      className={`text-left p-[var(--cx-space-3)] font-medium text-[var(--cx-text-primary)] ${className}`}
    >
      {children}
    </th>
  )
}

interface TableCellProps {
  children: React.ReactNode
  className?: string
}

export function TableCell({ children, className = '' }: TableCellProps) {
  return (
    <td className={`p-[var(--cx-space-3)] text-[var(--cx-text-primary)] ${className}`}>
      {children}
    </td>
  )
}
