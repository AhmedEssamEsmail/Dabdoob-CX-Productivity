'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy state-screen chrome around the sign-in form — same centred panel the
 * app uses for boot/no-access screens.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="state-screen">
      <h1>CX Helm Productivity</h1>
      <p>Sign in with your work account to continue.</p>
      <form onSubmit={handleLogin} style={{ display: 'contents' }}>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label className="field-label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@dabdoob.com"
            className="cx-input"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="cx-input"
          />
        </div>
        <button type="submit" disabled={loading} className="cx-btn cx-btn--primary">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="cx-muted">Secure access for CX Helm team members</p>
    </main>
  )
}
