'use client'

import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { cx } from './cx'

export interface PaintGridCell {
  id: string
  label?: string
  className?: string
  content?: ReactNode
  data?: Record<string, string | undefined>
}

export interface PaintGridRow {
  id: string
  label: ReactNode
  cells: PaintGridCell[]
}

export interface PaintGridColumnHeader {
  label: ReactNode
  span?: number
  className?: string
}

export interface PaintGridProps {
  rows: PaintGridRow[]
  columnHeaders?: PaintGridColumnHeader[]
  cornerLabel?: ReactNode
  readOnly?: boolean
  onPaint?: (rowId: string, cellIndex: number) => void
  onCommit?: () => void
  'aria-label'?: string
  className?: string
  rowClassName?: string
  rowHeadClassName?: string
  cellClassName?: string
  style?: CSSProperties
}

/* APG grid navigation over a flat row-major cell index.
   Arrows wrap across rows; Up/Down clamp; Home/End are per-row,
   Ctrl/Cmd+Home/End jump to the grid corners; RTL flips Left/Right. */
export function nextGridIndex(
  rowCount: number,
  colCount: number,
  index: number,
  key: string,
  opts: { ctrl?: boolean; rtl?: boolean } = {}
): number {
  const total = rowCount * colCount
  if (total <= 0 || colCount <= 0 || index < 0 || index >= total) return -1
  const { ctrl = false, rtl = false } = opts
  const r = Math.floor(index / colCount)
  if (ctrl && key === 'Home') return 0
  if (ctrl && key === 'End') return total - 1
  if (key === 'Home') return r * colCount
  if (key === 'End') return r * colCount + colCount - 1
  if (key === 'ArrowUp') return r > 0 ? index - colCount : index
  if (key === 'ArrowDown') return r < rowCount - 1 ? index + colCount : index
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    const step = (key === 'ArrowRight') !== rtl ? 1 : -1
    return (index + step + total) % total
  }
  return -1
}

export function PaintGrid({
  rows,
  columnHeaders,
  cornerLabel,
  readOnly,
  onPaint,
  onCommit,
  className,
  rowClassName,
  rowHeadClassName,
  cellClassName,
  ...rest
}: PaintGridProps) {
  const colCount = rows[0]?.cells.length ?? 0
  const total = rows.length * colCount
  const [focus, setFocus] = useState(0)
  const paintingRef = useRef(false)
  const cellRefs = useRef(new Map<string, HTMLElement>())

  const current = total > 0 ? Math.min(focus, total - 1) : -1

  const cellAt = (index: number) => {
    const r = Math.floor(index / colCount)
    const c = index % colCount
    return { row: rows[r], rowIndex: r, cellIndex: c }
  }

  const stopPainting = () => {
    if (!paintingRef.current) return
    paintingRef.current = false
    onCommit?.()
  }

  const paintAt = (index: number) => {
    if (readOnly || !onPaint) return
    const { row, cellIndex } = cellAt(index)
    if (!row) return
    onPaint(row.id, cellIndex)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (current < 0) return
    if (event.key === 'Enter' || event.key === ' ') {
      if (readOnly || !onPaint) return
      event.preventDefault()
      paintAt(current)
      onCommit?.()
      return
    }
    const rtl =
      typeof getComputedStyle === 'function'
        ? getComputedStyle(event.currentTarget).direction === 'rtl'
        : false
    const next = nextGridIndex(rows.length, colCount, current, event.key, {
      ctrl: event.ctrlKey || event.metaKey,
      rtl,
    })
    if (next < 0) return
    event.preventDefault()
    if (next === current) return
    setFocus(next)
    const el = cellRefs.current.get(
      `${Math.floor(next / colCount)}:${next % colCount}`
    )
    el?.focus()
  }

  return (
    <div
      role="grid"
      aria-readonly={readOnly || undefined}
      className={cx('cx-paintgrid', className)}
      onKeyDown={onKeyDown}
      onPointerUp={stopPainting}
      onPointerLeave={stopPainting}
      {...rest}
    >
      {columnHeaders && (
        <div
          role="row"
          className={cx('cx-paintgrid-row', 'cx-paintgrid-row--head', rowClassName)}
        >
          <span
            role="columnheader"
            className={cx('cx-paintgrid-rowhead', 'cx-paintgrid-colhead', rowHeadClassName)}
          >
            {cornerLabel}
          </span>
          {columnHeaders.map((h, i) => (
            <span
              key={i}
              role="columnheader"
              className={cx('cx-paintgrid-colhead', h.className)}
              style={h.span ? { gridColumn: 'span ' + h.span } : undefined}
            >
              {h.label}
            </span>
          ))}
        </div>
      )}
      {rows.map((row, r) => (
        <div
          role="row"
          className={cx('cx-paintgrid-row', rowClassName)}
          key={row.id}
        >
          <span
            role="rowheader"
            className={cx('cx-paintgrid-rowhead', rowHeadClassName)}
          >
            {row.label}
          </span>
          {row.cells.map((cell, c) => {
            const index = r * colCount + c
            const posKey = `${r}:${c}`
            const dataProps: Record<string, string> = {}
            if (cell.data) {
              for (const [k, v] of Object.entries(cell.data)) {
                if (v !== undefined) dataProps[`data-${k}`] = v
              }
            }
            return (
              <button
                key={cell.id}
                type="button"
                role="gridcell"
                ref={(el) => {
                  if (el) cellRefs.current.set(posKey, el)
                  else cellRefs.current.delete(posKey)
                }}
                tabIndex={index === current ? 0 : -1}
                aria-label={cell.label}
                title={cell.label}
                className={cx('cx-paintgrid-cell', cellClassName, cell.className)}
                {...dataProps}
                onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
                  if (readOnly || !onPaint) return
                  event.currentTarget.focus()
                  paintingRef.current = true
                  setFocus(index)
                  paintAt(index)
                }}
                onPointerEnter={() => {
                  if (!paintingRef.current) return
                  paintAt(index)
                }}
                onPointerUp={stopPainting}
                onPointerCancel={stopPainting}
              >
                {cell.content}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
