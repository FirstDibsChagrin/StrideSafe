'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://stridesafe-production.up.railway.app'

type Mode = 'signin' | 'signup'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stravaError = searchParams.get('strava') === 'error'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signupRole, setSignupRole] = useState<'coach' | 'runner'>('coach')
  const [error, setError] = useState<string | null>(stravaError ? 'Strava sign-in failed. Please try again.' : null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setSuccessMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        localStorage.setItem('pendingRole', signupRole)
        if (signUpData.session) {
          // Email confirmation disabled — user is immediately logged in
          router.push('/onboarding')
          router.refresh()
        } else {
          // Email confirmation required — ask them to check their inbox
          setSuccessMessage('Check your email to confirm your account, then sign in.')
          setEmail('')
          setPassword('')
          setConfirmPassword('')
        }
      } else {
        const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user!.id)
          .maybeSingle()
        router.push(profile?.role === 'coach' ? '/coach' : '/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    background: '#1e1e2e',
    border: '1px solid #2a2a3a',
    color: '#e2e2f0',
    borderRadius: '8px',
    padding: '8px 12px',
    width: '100%',
    fontSize: '14px',
    outline: 'none',
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: '#0d0d14' }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold" style={{ color: '#f97316' }}>StrideSafe</h1>
        <p className="mt-1 text-sm" style={{ color: '#6b6b80' }}>Welcome back</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Runners: Strava */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b6b80' }}>
            Runners
          </p>
          <p className="text-sm mb-4" style={{ color: '#6b6b80' }}>
            Sign in with your Strava account — no password needed.
          </p>
          {error && stravaError && (
            <p className="mb-3 text-sm text-red-400">{error}</p>
          )}
          <a
            href={`${API_URL}/auth/strava`}
            className="flex w-full items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#FC4C02' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Continue with Strava
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t" style={{ borderColor: '#2a2a3a' }} />
          <span className="text-xs" style={{ color: '#6b6b80' }}>or sign in as a coach</span>
          <div className="flex-1 border-t" style={{ borderColor: '#2a2a3a' }} />
        </div>

        {/* Coaches: email/password */}
        <div
          className="rounded-2xl p-6"
          style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#6b6b80' }}>
            Coaches
          </p>

          {/* Mode toggle */}
          <div
            className="mb-5 flex rounded-lg p-1 gap-1"
            style={{ background: '#1e1e2e', border: '1px solid #2a2a3a' }}
          >
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
              style={
                mode === 'signin'
                  ? { background: '#f97316', color: '#fff' }
                  : { color: '#6b6b80' }
              }
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
              style={
                mode === 'signup'
                  ? { background: '#f97316', color: '#fff' }
                  : { color: '#6b6b80' }
              }
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#6b6b80' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#6b6b80' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#6b6b80' }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#f97316')}
                    onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                  />
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#9ca3af' }}>
                    I am a…
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setSignupRole('coach')}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid',
                        borderColor: signupRole === 'coach' ? '#f97316' : '#2a2a3a',
                        background: signupRole === 'coach' ? '#2d1200' : '#1e1e2e',
                        color: signupRole === 'coach' ? '#f97316' : '#9ca3af',
                        fontWeight: 500, cursor: 'pointer', fontSize: '14px',
                      }}
                    >
                      🧑‍💼 Coach
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupRole('runner')}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid',
                        borderColor: signupRole === 'runner' ? '#f97316' : '#2a2a3a',
                        background: signupRole === 'runner' ? '#2d1200' : '#1e1e2e',
                        color: signupRole === 'runner' ? '#f97316' : '#9ca3af',
                        fontWeight: 500, cursor: 'pointer', fontSize: '14px',
                      }}
                    >
                      🏃 Runner
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && !stravaError && <p className="text-sm text-red-400">{error}</p>}
            {successMessage && <p className="text-sm" style={{ color: '#4ade80' }}>{successMessage}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#f97316' }}
            >
              {loading
                ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
