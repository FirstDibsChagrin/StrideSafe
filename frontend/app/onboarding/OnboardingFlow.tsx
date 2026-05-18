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

// Internal steps: 1=name, 2=role (skipped if locked), 3=team
type Step = 1 | 2 | 3

const inp: React.CSSProperties = {
  background: '#1e1e2e',
  border: '1px solid #2a2a3a',
  color: '#e2e2f0',
  borderRadius: '8px',
  padding: '10px 14px',
  width: '100%',
  fontSize: '14px',
  outline: 'none',
}

export default function OnboardingFlow({ userId, teams, lockedRole }: OnboardingFlowProps) {
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role | null>(lockedRole ?? null)
  const [teamSearch, setTeamSearch] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [createTeam, setCreateTeam] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamSchool, setNewTeamSchool] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Display step numbers: if role is locked, steps 1→1 and 3→2 (2 total); else 1,2,3
  const totalSteps = lockedRole ? 2 : 3
  const displayStep = lockedRole ? (step === 1 ? 1 : 2) : step

  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
      (t.school ?? '').toLowerCase().includes(teamSearch.toLowerCase()),
  )

  const pickRole = (r: Role) => {
    setRole(r)
    setCreateTeam(r === 'coach')
    setSelectedTeamId(null)
    setNewTeamName('')
    setNewTeamSchool('')
    setError(null)
    setStep(3)
  }

  const canSubmit = createTeam
    ? newTeamName.trim().length > 0
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
      router.push(role === 'coach' ? '/coach' : '/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

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

      {/* ── Step 1: Name ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#e2e2f0' }}>
              What&apos;s your name?
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              This is how you&apos;ll appear to your team.
            </p>
          </div>
          <input
            type="text"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            style={inp}
            onFocus={e => (e.target.style.borderColor = '#f97316')}
            onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
            onKeyDown={e => { if (e.key === 'Enter' && fullName.trim()) { lockedRole ? setStep(3) : setStep(2) } }}
          />
          <button
            disabled={!fullName.trim()}
            onClick={() => lockedRole ? setStep(3) : setStep(2)}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#f97316' }}
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: Role selection (skipped when locked) ── */}
      {step === 2 && !lockedRole && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#e2e2f0' }}>
              Are you a coach or a runner?
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              Choose your role — this determines your dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => pickRole('coach')}
              className="rounded-2xl p-8 text-left transition-all hover:scale-[1.02] active:scale-100"
              style={{ background: '#13131f', border: '2px solid #2a2a3a' }}
            >
              <div className="text-4xl mb-3">🧑‍💼</div>
              <p className="text-lg font-bold" style={{ color: '#e2e2f0' }}>Coach</p>
              <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>I manage a team</p>
            </button>
            <button
              onClick={() => pickRole('runner')}
              className="rounded-2xl p-8 text-left transition-all hover:scale-[1.02] active:scale-100"
              style={{ background: '#13131f', border: '2px solid #2a2a3a' }}
            >
              <div className="text-4xl mb-3">🏃</div>
              <p className="text-lg font-bold" style={{ color: '#e2e2f0' }}>Runner</p>
              <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>I train and race</p>
            </button>
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

      {/* ── Step 3: Team setup ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>
              {role === 'coach' ? 'Set up your team' : 'Join a team'}
            </h2>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              {role === 'coach'
                ? 'Create a new team or join an existing one.'
                : "Find your school's team to get started."}
            </p>
          </div>

          {/* Create / Join toggle — coaches only */}
          {role === 'coach' && (
            <div
              className="flex rounded-lg p-1 gap-1"
              style={{ background: '#1e1e2e', border: '1px solid #2a2a3a' }}
            >
              <button
                onClick={() => setCreateTeam(true)}
                className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
                style={createTeam ? { background: '#f97316', color: '#fff' } : { color: '#6b6b80' }}
              >
                Create new
              </button>
              <button
                onClick={() => setCreateTeam(false)}
                className="flex-1 rounded-md py-1.5 text-sm font-medium transition-colors"
                style={!createTeam ? { background: '#f97316', color: '#fff' } : { color: '#6b6b80' }}
              >
                Join existing
              </button>
            </div>
          )}

          {/* Create form */}
          {createTeam && role === 'coach' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>
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
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#9ca3af' }}>
                  School <span style={{ color: '#6b6b80' }} className="font-normal">(optional)</span>
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

          {/* Join list */}
          {(!createTeam || role === 'runner') && (
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
                className="max-h-52 overflow-y-auto rounded-xl"
                style={{ border: '1px solid #2a2a3a' }}
              >
                {filteredTeams.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-center" style={{ color: '#6b6b80' }}>
                    {role === 'coach'
                      ? 'No teams found. Switch to "Create new".'
                      : 'No teams found. Ask your coach to create one.'}
                  </p>
                ) : (
                  filteredTeams.map((team, i) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
                      style={{
                        background: selectedTeamId === team.id ? 'rgba(249,115,22,0.1)' : '#13131f',
                        borderTop: i > 0 ? '1px solid #2a2a3a' : undefined,
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#e2e2f0' }}>{team.name}</p>
                        {team.school && (
                          <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>{team.school}</p>
                        )}
                      </div>
                      {selectedTeamId === team.id && (
                        <span className="text-sm font-bold" style={{ color: '#f97316' }}>✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => lockedRole ? setStep(1) : setStep(2)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
              style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
            >
              Back
            </button>
            <button
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: '#f97316' }}
            >
              {submitting ? 'Setting up…' : createTeam ? 'Create Team' : 'Join Team'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
