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
}

type Role = 'runner' | 'coach'

export default function OnboardingFlow({ userId, teams }: OnboardingFlowProps) {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [role, setRole] = useState<Role | null>(null)
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
      router.push('/dashboard')
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
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                s === step
                  ? 'bg-blue-600 text-white'
                  : s < step
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s}
            </div>
            {s < 3 && <div className={`h-px w-8 ${s < step ? 'bg-blue-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Role ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Are you a runner or a coach?</h2>
            <p className="mt-1 text-sm text-gray-500">
              This determines what you see on your dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setRole('runner')}
              className={`rounded-xl border-2 p-6 text-left transition-colors ${
                role === 'runner'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">🏃</div>
              <p className="font-semibold text-gray-900">Runner</p>
              <p className="mt-1 text-xs text-gray-500">Track your training and injury risk</p>
            </button>
            <button
              onClick={() => setRole('coach')}
              className={`rounded-xl border-2 p-6 text-left transition-colors ${
                role === 'coach'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">📋</div>
              <p className="font-semibold text-gray-900">Coach</p>
              <p className="mt-1 text-xs text-gray-500">Monitor your team&apos;s health</p>
            </button>
          </div>
          <button
            disabled={!role}
            onClick={() => setStep(2)}
            className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Step 2: Personal info ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tell us about yourself</h2>
            <p className="mt-1 text-sm text-gray-500">
              {role === 'runner' ? 'Used to personalise your injury risk model.' : 'So your runners know who you are.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {role === 'runner' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="16"
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender identity <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="e.g. Female, Male, Non-binary…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex-1 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              disabled={!canAdvanceStep2}
              onClick={() => setStep(3)}
              className="flex-1 rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
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
            <h2 className="text-xl font-bold text-gray-900">Join a team</h2>
            <p className="mt-1 text-sm text-gray-500">
              Find your school&apos;s team or create a new one.
            </p>
          </div>

          {/* Toggle: join vs create */}
          <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
            <button
              onClick={() => setCreateTeam(false)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                !createTeam ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Join existing team
            </button>
            <button
              onClick={() => setCreateTeam(true)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                createTeam ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Create new team
            </button>
          </div>

          {!createTeam ? (
            <div className="space-y-3">
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search by school or team name…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                {filteredTeams.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">
                    No teams found. Try creating one.
                  </p>
                ) : (
                  filteredTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                        selectedTeamId === team.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{team.name}</p>
                        {team.school && (
                          <p className="text-xs text-gray-500">{team.school}</p>
                        )}
                      </div>
                      {selectedTeamId === team.id && (
                        <span className="text-blue-600 text-sm">✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Varsity Cross Country"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTeamSchool}
                  onChange={(e) => setNewTeamSchool(e.target.value)}
                  placeholder="Lincoln High School"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              disabled={!canAdvanceStep3 || submitting}
              onClick={handleSubmit}
              className="flex-1 rounded-md bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? 'Setting up…' : 'Go to Dashboard'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
