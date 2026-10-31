import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="max-w-7xl mx-auto flex gap-6">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/status-validation" className="hover:underline">Status Validation</Link>
        <Link href="/my-status" className="hover:underline">My Status</Link>
        <Link href="/auth/logout" className="hover:underline">Logout</Link>
      </div>
    </nav>
  )
}
