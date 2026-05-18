'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Team { id: string; name: string; school: string | null }

interface Props {
  userId: string
  teams: Team[]
  lockedRole: 'coach' | 'runner' | null
}

const field: React.CSSProperties = {
  background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0',
  borderRadius: '8px', padding: '10px 14px', width: '100%', fontSize: '14px', outline: 'none',
}

export default function OnboardingFlow({ userId, teams, lockedRole }: Props) {
  const router = useRouter()

  // Step 1 = name, 2 = role (skipped if locked), 3 = team
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [role, setRole] = useState<'coach' | 'runner' | null>(lockedRole)
  const [creating, setCreating] = useState(true)      // coach only: create vs join
  const [teamName, setTeamName] = useState('')
  const [school, setSchool] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const filtered = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.school ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function chooseRole(r: 'coach' | 'runner') {
    setRole(r)
    setCreating(r === 'coach')
    setSelectedTeam(null)
    setTeamName('')
    setSchool('')
    setError('')
    setStep(3)
  }

  const canSubmit = creating ? teamName.trim().length > 0 : selectedTeam !== null

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        role,
        full_name: name.trim(),
        team_id: creating ? null : selectedTeam,
        create_team: creating,
        team_name: teamName.trim(),
        team_school: school.trim(),
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }
    router.push(role === 'coach' ? '/coach' : '/dashboard')
    router.refresh()
  }

  // Step indicator: 2 steps if role locked, 3 if not
  const total = lockedRole ? 2 : 3
  const display = lockedRole ? (step === 1 ? 1 : 2) : step

  return (
    <div>
      {/* Step dots */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: total }, (_, i) => i + 1).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={s === display
                ? { background: '#f97316', color: '#fff' }
                : s < display
                  ? { background: 'rgba(249,115,22,0.2)', color: '#f97316' }
                  : { background: '#1e1e2e', color: '#6b6b80' }}
            >
              {s}
            </div>
            {s < total && <div className="w-8 h-px" style={{ background: s < display ? '#f97316' : '#2a2a3a' }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Name */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#e2e2f0' }}>What&apos;s your name?</h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>This is how you&apos;ll appear to your team.</p>
          </div>
          <input
            autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Jane Smith" style={field}
            onFocus={e => (e.target.style.borderColor = '#f97316')}
            onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
            onKeyDown={e => e.key === 'Enter' && name.trim() && (lockedRole ? setStep(3) : setStep(2))}
          />
          <button
            disabled={!name.trim()}
            onClick={() => lockedRole ? setStep(3) : setStep(2)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#f97316' }}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2 — Role */}
      {step === 2 && !lockedRole && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#e2e2f0' }}>Are you a coach or runner?</h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>This sets your dashboard view.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {([['coach', '🧑‍💼', 'I manage a team'], ['runner', '🏃', 'I train and race']] as const).map(([r, icon, desc]) => (
              <button
                key={r} onClick={() => chooseRole(r)}
                className="rounded-2xl p-8 text-left transition-all hover:scale-[1.02]"
                style={{ background: '#13131f', border: '2px solid #2a2a3a' }}
              >
                <div className="text-4xl mb-3">{icon}</div>
                <p className="text-lg font-bold capitalize" style={{ color: '#e2e2f0' }}>{r}</p>
                <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>{desc}</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(1)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
          >
            Back
          </button>
        </div>
      )}

      {/* Step 3 — Team */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>
              {role === 'coach' ? 'Set up your team' : 'Join a team'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              {role === 'coach' ? 'Create a new team or join an existing one.' : "Find your school's team."}
            </p>
          </div>

          {/* Create / Join toggle — coaches only */}
          {role === 'coach' && (
            <div className="flex rounded-lg p-1 gap-1" style={{ background: '#1e1e2e', border: '1px solid #2a2a3a' }}>
              {[true, false].map(c => (
                <button
                  key={String(c)} onClick={() => setCreating(c)}
                  className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
                  style={creating === c ? { background: '#f97316', color: '#fff' } : { color: '#6b6b80' }}
                >
                  {c ? 'Create new' : 'Join existing'}
                </button>
              ))}
            </div>
          )}

          {/* Create form */}
          {creating && role === 'coach' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>
                  Team name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
                  placeholder="Varsity Cross Country" style={field}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>
                  School <span className="font-normal" style={{ color: '#6b6b80' }}>(optional)</span>
                </label>
                <input
                  type="text" value={school} onChange={e => setSchool(e.target.value)}
                  placeholder="Lincoln High School" style={field}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>
            </div>
          )}

          {/* Join list */}
          {(!creating || role === 'runner') && (
            <div className="space-y-3">
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search teams…" style={field}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
              <div className="max-h-52 overflow-y-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
                {filtered.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center" style={{ color: '#6b6b80' }}>
                    {role === 'coach' ? 'No teams found. Switch to "Create new".' : 'No teams found. Ask your coach to create one.'}
                  </p>
                ) : filtered.map((t, i) => (
                  <button
                    key={t.id} onClick={() => setSelectedTeam(t.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    style={{
                      background: selectedTeam === t.id ? 'rgba(249,115,22,0.1)' : '#13131f',
                      borderTop: i > 0 ? '1px solid #2a2a3a' : undefined,
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#e2e2f0' }}>{t.name}</p>
                      {t.school && <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>{t.school}</p>}
                    </div>
                    {selectedTeam === t.id && <span className="font-bold" style={{ color: '#f97316' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => lockedRole ? setStep(1) : setStep(2)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
            >
              Back
            </button>
            <button
              disabled={!canSubmit || submitting} onClick={handleSubmit}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: '#f97316' }}
            >
              {submitting ? 'Setting up…' : creating ? 'Create Team' : 'Join Team'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
