'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const inp: React.CSSProperties = {
  background: '#1e1e2e',
  border: '1px solid #2a2a3a',
  color: '#e2e2f0',
  borderRadius: '8px',
  padding: '8px 12px',
  width: '100%',
  fontSize: '14px',
  outline: 'none',
}

export default function CreateTeamForm() {
  const router = useRouter()
  const [teamName, setTeamName] = useState('')
  const [teamSchool, setTeamSchool] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/create-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim(), school: teamSchool.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create team')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-w-sm">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
          Team name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          required
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Varsity Cross Country"
          style={inp}
          onFocus={e => (e.target.style.borderColor = '#f97316')}
          onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
          School name <span style={{ color: '#6b6b80' }} className="font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={teamSchool}
          onChange={(e) => setTeamSchool(e.target.value)}
          placeholder="Lincoln High School"
          style={inp}
          onFocus={e => (e.target.style.borderColor = '#f97316')}
          onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
        />
      </div>
      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
      <button
        type="submit"
        disabled={submitting || !teamName.trim()}
        className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: '#f97316' }}
      >
        {submitting ? 'Creating…' : 'Create Team'}
      </button>
    </form>
  )
}
