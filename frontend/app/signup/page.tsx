'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://stridesafe-production.up.railway.app'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/onboarding')
    router.refresh()
  }

  const field: React.CSSProperties = {
    background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0',
    borderRadius: '8px', padding: '10px 14px', width: '100%', fontSize: '14px', outline: 'none',
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0d0d14' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#f97316' }}>StrideSafe</h1>
          <p className="mt-1 text-sm" style={{ color: '#6b6b80' }}>Create your account</p>
        </div>

        <div className="rounded-2xl p-8 space-y-5" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>Confirm Password</label>
              <input
                type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••" style={field}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#f97316' }}
            >
              {loading ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t" style={{ borderColor: '#2a2a3a' }} />
            <span className="text-xs" style={{ color: '#6b6b80' }}>or</span>
            <div className="flex-1 border-t" style={{ borderColor: '#2a2a3a' }} />
          </div>

          <a
            href={`${API_URL}/auth/strava`}
            className="flex w-full items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#FC4C02' }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Sign up with Strava
          </a>

          <p className="text-center text-sm" style={{ color: '#6b6b80' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#f97316' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
