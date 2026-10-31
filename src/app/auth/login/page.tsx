'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand__mark" aria-hidden="true">CX</span>
          <span>CX HELM <span aria-hidden="true">/</span> PRODUCTIVITY</span>
        </div>
        <div className="login-heading">
          <p className="login-eyebrow">TEAM WORKSPACE</p>
          <h1>Welcome back.</h1>
          <p>Sign in with your work account to continue.</p>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <div className="login-field">
            <label htmlFor="email">
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
              placeholder="name@company.com"
              className="login-input"
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">
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
              className="login-input"
            />
          </div>
          <button type="submit" disabled={loading} className="login-submit">
            {loading ? 'Signing in...' : 'Sign in'}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <p className="login-footnote">Secure access for CX Helm team members</p>
      </div>
    </div>
  )
}
