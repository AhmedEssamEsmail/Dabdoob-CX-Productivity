import Link from 'next/link'
import { ThemeToggle } from '../ui/ThemeToggle'
import { LanguageToggle } from '../ui/LanguageToggle'

export default function TopBar() {
  return (
    <header
      className="bg-[var(--cx-accent)] text-[var(--cx-accent-ink)] sticky top-0 z-50"
      style={{ height: 'var(--cx-topbar-height)' }}
    >
      <div className="h-full px-[var(--cx-space-4)] flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg hover:opacity-80 transition-opacity">
          CX Helm Productivity
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
