'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const field: React.CSSProperties = {
  background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0',
  borderRadius: '8px', padding: '10px 14px', width: '100%', fontSize: '14px', outline: 'none',
}

const STRAVA_MESSAGES: Record<string, { text: string; color: string }> = {
  limit: {
    text: 'Strava sign-in is temporarily unavailable — the app has reached its athlete connection limit. Please sign up with email instead, or try again later.',
    color: '#f97316',
  },
  error: {
    text: 'Strava sign-in failed. Please try again or sign in with email.',
    color: '#ef4444',
  },
}

function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  const stravaParam = searchParams.get('strava')
  const stravaMsg = stravaParam ? STRAVA_MESSAGES[stravaParam] : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0d0d14' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: '#e2e2f0' }}>
            Stride<span style={{ color: '#f97316' }}>Safe</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#6b6b80' }}>Sign in to your account</p>
        </div>

        {stravaMsg && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(249,115,22,0.08)', border: `1px solid ${stravaMsg.color}40`, color: stravaMsg.color }}>
            {stravaMsg.text}
          </div>
        )}

        <div className="rounded-2xl p-8" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>Email</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" style={field}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>Password</label>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={field}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
            </div>

            {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#f97316' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: '#6b6b80' }}>
            No account?{' '}
            <Link href="/signup" className="font-semibold" style={{ color: '#f97316' }}>Sign Up</Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
