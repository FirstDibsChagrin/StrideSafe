'use client'

import { useState } from 'react'

interface RunnerActivity {
  strava_activity_id: string
  activity_date: string | null
  distance_meters: number | null
  avg_pace_sec_per_km: number | null
  duration_seconds: number | null
  workout_type: string | null
}

interface RunnerCheckin {
  checkin_date: string
  pain_level: number | null
  fatigue_level: number | null
  stress_level: number | null
  sleep_hours: number | null
  soreness_notes: string | null
}

interface RunnerInjury {
  id: string
  injury_type: string | null
  body_location: string | null
  reported_at: string | null
}

interface RunnerData {
  id: string
  full_name: string | null
  latestRisk: {
    global_score: number
    onset_days: number
    recommendations: string[] | null
    date: string
  } | null
  latestMetrics: {
    acwr: number | null
    weekly_mileage_km: number | null
    date: string
  } | null
  lastRuns: RunnerActivity[]
  latestCheckin: RunnerCheckin | null
  unconfirmedInjuries: RunnerInjury[]
}

interface RunnerListProps {
  runners: RunnerData[]
  coachId: string
}

function riskBadgeClass(score: number) {
  if (score >= 70) return 'bg-red-100 text-red-700'
  if (score >= 40) return 'bg-yellow-100 text-yellow-700'
  return 'bg-green-100 text-green-700'
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm) return '—'
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function RunnerRow({
  runner,
  coachId,
}: {
  runner: RunnerData
  coachId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [injuries, setInjuries] = useState<RunnerInjury[]>(runner.unconfirmedInjuries)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const score = runner.latestRisk?.global_score ?? null

  const handleSaveNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await fetch('/api/coach/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runner_id: runner.id, coach_id: coachId, note }),
      })
      setNote('')
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 3000)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmInjury = async (injuryId: string) => {
    setConfirmingId(injuryId)
    try {
      await fetch('/api/coach/confirm-injury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ injury_id: injuryId }),
      })
      setInjuries((prev) => prev.filter((i) => i.id !== injuryId))
    } catch {
      // silent
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {runner.full_name ?? 'Unknown'}
            </span>
            {score !== null && score > 70 && (
              <span title="High risk" className="text-red-500 text-base">⚑</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Last sync: {runner.latestMetrics?.date ?? 'never'}
          </p>
        </div>

        {/* Risk score badge */}
        <div className="flex-shrink-0">
          {score !== null ? (
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskBadgeClass(score)}`}
            >
              {score}
            </span>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>

        {/* ACWR */}
        <div className="flex-shrink-0 w-16 text-right">
          <p className="text-xs text-gray-400">ACWR</p>
          <p className="text-sm font-medium text-gray-700">
            {runner.latestMetrics?.acwr?.toFixed(2) ?? '—'}
          </p>
        </div>

        {/* Weekly mileage */}
        <div className="flex-shrink-0 w-20 text-right">
          <p className="text-xs text-gray-400">Wk km</p>
          <p className="text-sm font-medium text-gray-700">
            {runner.latestMetrics?.weekly_mileage_km?.toFixed(1) ?? '—'}
          </p>
        </div>

        <span className="flex-shrink-0 text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-5 space-y-5 bg-gray-50">
          {/* Last 5 runs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Last 5 Runs
            </p>
            {runner.lastRuns.length === 0 ? (
              <p className="text-sm text-gray-400">No runs on record.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-1 pr-3">Date</th>
                    <th className="pb-1 pr-3">Distance</th>
                    <th className="pb-1 pr-3">Pace</th>
                    <th className="pb-1">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {runner.lastRuns.map((run) => (
                    <tr key={run.strava_activity_id} className="text-gray-700">
                      <td className="py-1 pr-3">{run.activity_date?.slice(0, 10) ?? '—'}</td>
                      <td className="py-1 pr-3">
                        {run.distance_meters != null
                          ? (run.distance_meters / 1000).toFixed(2) + ' km'
                          : '—'}
                      </td>
                      <td className="py-1 pr-3">{formatPace(run.avg_pace_sec_per_km)}/km</td>
                      <td className="py-1">{run.workout_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Latest check-in */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Latest Check-in{runner.latestCheckin ? ` (${runner.latestCheckin.checkin_date})` : ''}
            </p>
            {runner.latestCheckin ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
                <span>Pain: <strong>{runner.latestCheckin.pain_level ?? '—'}</strong>/10</span>
                <span>Fatigue: <strong>{runner.latestCheckin.fatigue_level ?? '—'}</strong>/10</span>
                <span>Stress: <strong>{runner.latestCheckin.stress_level ?? '—'}</strong>/10</span>
                <span>Sleep: <strong>{runner.latestCheckin.sleep_hours ?? '—'}</strong> hrs</span>
                {runner.latestCheckin.soreness_notes && (
                  <span className="col-span-2 text-gray-500 italic">
                    &ldquo;{runner.latestCheckin.soreness_notes}&rdquo;
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No check-in on record.</p>
            )}
          </div>

          {/* Risk breakdown */}
          {runner.latestRisk && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Risk Breakdown
              </p>
              <div className="text-sm text-gray-700 space-y-1">
                <p>Global score: <strong>{runner.latestRisk.global_score}</strong> / 100</p>
                <p>Injury window: <strong>{runner.latestRisk.onset_days} days</strong></p>
                {runner.latestRisk.recommendations?.length ? (
                  <ul className="mt-1 space-y-1">
                    {runner.latestRisk.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-1.5 text-gray-600">
                        <span className="text-blue-400">•</span> {r}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {/* Unconfirmed injuries */}
          {injuries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-2">
                Unconfirmed Injuries
              </p>
              <div className="space-y-2">
                {injuries.map((inj) => (
                  <div
                    key={inj.id}
                    className="flex items-center justify-between rounded-md border border-orange-200 bg-orange-50 px-3 py-2"
                  >
                    <div className="text-sm text-orange-800">
                      <p>
                        {inj.injury_type ?? 'Injury reported'}
                        {inj.body_location ? ` — ${inj.body_location}` : ''}
                      </p>
                      {inj.reported_at && (
                        <p className="text-xs opacity-60">{inj.reported_at.slice(0, 10)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleConfirmInjury(inj.id)}
                      disabled={confirmingId === inj.id}
                      className="ml-4 rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      {confirmingId === inj.id ? 'Confirming…' : 'Confirm'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach note */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Add Note
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Write a note for this runner…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSaveNote}
                disabled={saving || !note.trim()}
                className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Note'}
              </button>
              {noteSaved && <span className="text-xs text-green-600">Note saved!</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RunnerList({ runners, coachId }: RunnerListProps) {
  if (runners.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-gray-400">
        No runners found for your team.
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {runners.map((runner) => (
        <RunnerRow key={runner.id} runner={runner} coachId={coachId} />
      ))}
    </div>
  )
}
