'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Team {
  id: string
  name: string
  school: string | null
}

interface OnboardingFlowProps {
  userId: string
  teams: Team[]
  lockedRole: 'runner' | 'coach' | null
}

type Role = 'runner' | 'coach'

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

export default function OnboardingFlow({ userId, teams, lockedRole }: OnboardingFlowProps) {
  const router = useRouter()

  const [step, setStep] = useState(lockedRole ? 2 : 1)
  const [role, setRole] = useState<Role | null>(() => {
    if (lockedRole) return lockedRole
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('pendingRole') as Role) || null
    }
    return null
  })
  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [gender, setGender] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [createTeam, setCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamSchool, setNewTeamSchool] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
      (t.school ?? '').toLowerCase().includes(teamSearch.toLowerCase()),
  )

  const canAdvanceStep2 = fullName.trim().length > 0

  const canAdvanceStep3 =
    createTeam
      ? newTeamName.trim().length > 0 && newTeamSchool.trim().length > 0
      : selectedTeamId !== null

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          role,
          full_name: fullName.trim(),
          age: age !== '' ? age : null,
          gender: gender.trim() || null,
          team_id: createTeam ? null : selectedTeamId,
          create_team: createTeam,
          team_name: newTeamName.trim(),
          team_school: newTeamSchool.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Something went wrong')
      }
      localStorage.removeItem('pendingRole')
      router.push(role === 'coach' ? '/coach' : '/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const totalSteps = lockedRole ? 2 : 3
  const displayStep = lockedRole ? step - 1 : step

  return (
    <div className="mx-auto max-w-lg">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={
                s === displayStep
                  ? { background: '#f97316', color: '#fff' }
                  : s < displayStep
                    ? { background: 'rgba(249,115,22,0.2)', color: '#f97316' }
                    : { background: '#1e1e2e', color: '#6b6b80' }
              }
            >
              {s}
            </div>
            {s < totalSteps && (
              <div
                className="h-px w-8"
                style={{ background: s < displayStep ? '#f97316' : '#2a2a3a' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Role (only shown when role is not locked) ── */}
      {step === 1 && !lockedRole && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>
              Are you a runner or a coach?
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              This determines what you see on your dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('runner')}
              className="rounded-xl p-6 text-left transition-colors"
              style={{
                border: `2px solid ${role === 'runner' ? '#f97316' : '#2a2a3a'}`,
                background: role === 'runner' ? '#2d1200' : '#1e1e2e',
              }}
            >
              <div className="text-3xl mb-2">🏃</div>
              <p className="font-semibold" style={{ color: '#e2e2f0' }}>Runner</p>
              <p className="mt-1 text-xs" style={{ color: '#9ca3af' }}>
                Track your training and injury risk
              </p>
            </button>
            <button
              onClick={() => setRole('coach')}
              className="rounded-xl p-6 text-left transition-colors"
              style={{
                border: `2px solid ${role === 'coach' ? '#f97316' : '#2a2a3a'}`,
                background: role === 'coach' ? '#2d1200' : '#1e1e2e',
              }}
            >
              <div className="text-3xl mb-2">📋</div>
              <p className="font-semibold" style={{ color: '#e2e2f0' }}>Coach</p>
              <p className="mt-1 text-xs" style={{ color: '#9ca3af' }}>
                Monitor your team&apos;s health
              </p>
            </button>
          </div>
          <button
            disabled={!role}
            onClick={() => setStep(2)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#f97316' }}
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: Personal info ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>
              Tell us about yourself
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              {role === 'runner'
                ? 'Used to personalise your injury risk model.'
                : 'So your runners know who you are.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
              Full name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              style={inp}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
            />
          </div>

          {role === 'runner' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
                  Age <span style={{ color: '#6b6b80' }} className="font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="16"
                  style={{ ...inp, width: '7rem' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
                  Gender identity <span style={{ color: '#6b6b80' }} className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="e.g. Female, Male, Non-binary…"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            {!lockedRole && (
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
              >
                Back
              </button>
            )}
            <button
              disabled={!canAdvanceStep2}
              onClick={() => setStep(3)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: '#f97316' }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Team ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>Join a team</h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              Find your school&apos;s team or create a new one.
            </p>
          </div>

          {/* Toggle: join vs create */}
          <div
            className="flex rounded-lg p-1 gap-1"
            style={{ background: '#1e1e2e', border: '1px solid #2a2a3a' }}
          >
            <button
              onClick={() => setCreateTeam(false)}
              className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
              style={!createTeam ? { background: '#f97316', color: '#fff' } : { color: '#6b6b80' }}
            >
              Join existing
            </button>
            <button
              onClick={() => setCreateTeam(true)}
              className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
              style={createTeam ? { background: '#f97316', color: '#fff' } : { color: '#6b6b80' }}
            >
              Create new
            </button>
          </div>

          {!createTeam ? (
            <div className="space-y-3">
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search by school or team name…"
                style={inp}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
              <div
                className="max-h-56 overflow-y-auto rounded-xl divide-y"
                style={{ border: '1px solid #2a2a3a', divideColor: '#2a2a3a' }}
              >
                {filteredTeams.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-center" style={{ color: '#6b6b80' }}>
                    No teams found. Try creating one.
                  </p>
                ) : (
                  filteredTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors"
                      style={{
                        background: selectedTeamId === team.id ? 'rgba(249,115,22,0.1)' : '#13131f',
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#e2e2f0' }}>
                          {team.name}
                        </p>
                        {team.school && (
                          <p className="text-xs" style={{ color: '#6b6b80' }}>{team.school}</p>
                        )}
                      </div>
                      {selectedTeamId === team.id && (
                        <span style={{ color: '#f97316' }}>✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
                  Team name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Varsity Cross Country"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#9ca3af' }}>
                  School name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newTeamSchool}
                  onChange={(e) => setNewTeamSchool(e.target.value)}
                  placeholder="Lincoln High School"
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
            >
              Back
            </button>
            <button
              disabled={!canAdvanceStep3 || submitting}
              onClick={handleSubmit}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: '#f97316' }}
            >
              {submitting ? 'Setting up…' : 'Go to Dashboard'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
