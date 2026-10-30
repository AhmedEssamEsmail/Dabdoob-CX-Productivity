import { getUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const user = await getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900">CX Helm Productivity</h1>
          <p className="mt-4 text-gray-600">
            Welcome! Authentication is working.
          </p>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Logged in as:</strong> {user.email}
            </p>
          </div>
          <a
            href="/auth/logout"
            className="mt-6 inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Sign out
          </a>
        </div>
      </div>
    </div>
  )
}
