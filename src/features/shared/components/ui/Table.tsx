import {
  forwardRef,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'
import { cx } from './cx'

export type TableProps = TableHTMLAttributes<HTMLTableElement>

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, ...rest },
  ref
) {
  return <table ref={ref} className={cx('cx-table', className)} {...rest} />
})

export type THeadProps = HTMLAttributes<HTMLTableSectionElement>

export const THead = forwardRef<HTMLTableSectionElement, THeadProps>(
  function THead({ className, ...rest }, ref) {
    return <thead ref={ref} className={className} {...rest} />
  }
)

export type TBodyProps = HTMLAttributes<HTMLTableSectionElement>

export const TBody = forwardRef<HTMLTableSectionElement, TBodyProps>(
  function TBody({ className, ...rest }, ref) {
    return <tbody ref={ref} className={className} {...rest} />
  }
)

export type TRProps = HTMLAttributes<HTMLTableRowElement>

export const TR = forwardRef<HTMLTableRowElement, TRProps>(function TR(
  { className, ...rest },
  ref
) {
  return <tr ref={ref} className={className} {...rest} />
})

export type THProps = ThHTMLAttributes<HTMLTableCellElement>

export const TH = forwardRef<HTMLTableCellElement, THProps>(function TH(
  { className, ...rest },
  ref
) {
  return <th ref={ref} className={className} {...rest} />
})

export type TDProps = TdHTMLAttributes<HTMLTableCellElement>

export const TD = forwardRef<HTMLTableCellElement, TDProps>(function TD(
  { className, ...rest },
  ref
) {
  return <td ref={ref} className={className} {...rest} />
})

export type TableWrapProps = HTMLAttributes<HTMLDivElement>

export const TableWrap = forwardRef<HTMLDivElement, TableWrapProps>(
  function TableWrap({ className, ...rest }, ref) {
    return <div ref={ref} className={cx('cx-tablewrap', className)} {...rest} />
  }
)
