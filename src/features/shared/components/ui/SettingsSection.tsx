import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export interface SettingsSectionProps
  extends Omit<HTMLAttributes<HTMLElement>, 'id' | 'title'> {
  id: string
  title: ReactNode
  children?: ReactNode
}

export const SettingsSection = forwardRef<
  HTMLElement,
  SettingsSectionProps
>(function SettingsSection({ id, title, className, children, ...rest }, ref) {
  const headingId = `${id}-heading`
  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={headingId}
      className={cx('cx-panel cx-settings-section', className)}
      {...rest}
    >
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  )
})

export interface SettingsTocItem {
  id: string
  label: ReactNode
}

export interface SettingsTocProps
  extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  items: SettingsTocItem[]
  label?: string
}

export const SettingsToc = forwardRef<HTMLElement, SettingsTocProps>(
  function SettingsToc({ items, label = 'Settings', className, ...rest }, ref) {
    return (
      <nav
        ref={ref}
        aria-label={label}
        className={cx('cx-toc', className)}
        {...rest}
      >
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    )
  }
)
