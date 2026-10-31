import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="bg-accent text-(--cx-accent-ink)" style={{ height: 'var(--cx-topbar-height)' }}>
      <div className="max-w-7xl mx-auto px-(--cx-space-4) h-full flex items-center gap-6">
        <Link href="/" className="font-semibold text-lg hover:opacity-80 transition-opacity">
          CX Helm Productivity
        </Link>
        <div className="flex gap-4 ml-auto">
          <Link href="/status-validation" className="hover:opacity-80 transition-opacity text-sm font-medium">
            Status Validation
          </Link>
          <Link href="/my-status" className="hover:opacity-80 transition-opacity text-sm font-medium">
            My Status
          </Link>
          <Link href="/auth/logout" className="hover:opacity-80 transition-opacity text-sm font-medium">
            Logout
          </Link>
        </div>
      </div>
    </nav>
  )
}
