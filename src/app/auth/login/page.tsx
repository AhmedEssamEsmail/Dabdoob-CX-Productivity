'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Field, Input } from '@/features/shared/components/ui'

function UrlErrorNotice({ onError }: { onError: (message: string) => void }) {
  const params = useSearchParams()

  useEffect(() => {
    const code = params.get('error')
    if (!code) return
    onError(
      code === 'denied'
        ? "That Google account isn't authorised for the CX Hub. Ask the CX admin to add you to the roster."
        : 'Google sign-in failed. Try again or use email and password.'
    )
  }, [params, onError])

  return null
}

/**
 * Legacy state-screen chrome around the sign-in form — same centred panel the
 * app uses for boot/no-access screens.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
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

  const handleGoogle = async () => {
    setGoogleBusy(true)
    setError('')

    try {
      const response = await fetch('/api/auth/google', { method: 'POST' })
      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start Google sign-in')
      }

      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to start Google sign-in')
      setGoogleBusy(false)
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <div className="brand-row">
          <img
            className="brand-logo"
            src="/assets/dabdoob-logo.png"
            alt=""
            aria-hidden="true"
          />
          <div>
            <div className="brand-name">Dabdoob CX</div>
            <div className="brand-sub">dabdoob operations console</div>
          </div>
        </div>

        <Suspense fallback={null}>
          <UrlErrorNotice onError={setError} />
        </Suspense>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">Use your dabdoob.com work account to continue.</p>

        {error && (
          <div className="login-error" role="alert">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <Field label="Email address">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@dabdoob.com"
            />
          </Field>
          <Field
            label={
              <span className="between">
                <span>Password</span>
                <span
                  className="small"
                  style={{ color: 'var(--cx-accent-text)', fontWeight: 600 }}
                >
                  Forgot password?
                </span>
              </span>
            }
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" disabled={loading || googleBusy}>
            {loading ? 'Signing in…' : 'Sign in'}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>
        <Button
          type="button"
          variant="quiet"
          className="login-google"
          onClick={handleGoogle}
          disabled={loading || googleBusy}
        >
          {googleBusy ? 'Redirecting…' : 'Continue with Google'}
        </Button>

        <div className="login-foot">
          <span className="flex">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Restricted to Dabdoob CX team members
          </span>
          <span>v2.4</span>
        </div>
      </div>
    </main>
  )
}
