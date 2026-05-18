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

function riskBadgeStyle(score: number): React.CSSProperties {
  if (score >= 70) return { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
  if (score >= 40) return { background: 'rgba(250,204,21,0.15)', color: '#fbbf24' }
  return { background: 'rgba(74,222,128,0.15)', color: '#4ade80' }
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm) return '—'
  const secPerMile = secPerKm * 1.60934
  const min = Math.floor(secPerMile / 60)
  const sec = Math.round(secPerMile % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const inp: React.CSSProperties = {
  background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0',
  borderRadius: '8px', padding: '8px 12px', width: '100%', fontSize: '13px', outline: 'none',
}

function RunnerRow({ runner, coachId }: { runner: RunnerData; coachId: string }) {
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
    } catch { /* silent */ } finally { setSaving(false) }
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
    } catch { /* silent */ } finally { setConfirmingId(null) }
  }

  return (
    <div style={{ borderBottom: '1px solid #2a2a3a' }} className="last:border-b-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors"
        style={{ background: expanded ? '#1a1a2e' : '#13131f' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#1a1a2e' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = '#13131f' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate" style={{ color: '#e2e2f0' }}>
              {runner.full_name ?? 'Unknown'}
            </span>
            {score !== null && score > 70 && (
              <span title="High risk" style={{ color: '#ef4444' }}>⚑</span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>
            Last sync: {runner.latestMetrics?.date ?? 'never'}
          </p>
        </div>

        <div className="flex-shrink-0 w-16 text-center">
          {score !== null ? (
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={riskBadgeStyle(score)}
            >
              {score}
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#3a3a4a' }}>—</span>
          )}
        </div>

        <div className="flex-shrink-0 w-16 text-right">
          <p className="text-xs" style={{ color: '#6b6b80' }}>ACWR</p>
          <p className="text-sm font-medium" style={{ color: '#e2e2f0' }}>
            {runner.latestMetrics?.acwr?.toFixed(2) ?? '—'}
          </p>
        </div>

        <div className="flex-shrink-0 w-20 text-right">
          <p className="text-xs" style={{ color: '#6b6b80' }}>Wk mi</p>
          <p className="text-sm font-medium" style={{ color: '#e2e2f0' }}>
            {runner.latestMetrics?.weekly_mileage_km != null
              ? (runner.latestMetrics.weekly_mileage_km * 0.621371).toFixed(1)
              : '—'}
          </p>
        </div>

        <span className="flex-shrink-0 text-xs" style={{ color: '#6b6b80' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-5 space-y-5" style={{ background: '#0f0f1a' }}>
          {/* Last 5 runs */}
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>
              Last 5 Runs
            </p>
            {runner.lastRuns.length === 0 ? (
              <p className="text-sm" style={{ color: '#6b6b80' }}>No runs on record.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: '#6b6b80', borderBottom: '1px solid #2a2a3a' }}>
                    <th className="pb-1 pr-3 font-medium">Date</th>
                    <th className="pb-1 pr-3 font-medium">Distance</th>
                    <th className="pb-1 pr-3 font-medium">Pace</th>
                    <th className="pb-1 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {runner.lastRuns.map((run) => (
                    <tr key={run.strava_activity_id} style={{ color: '#e2e2f0', borderBottom: '1px solid #1e1e2e' }}>
                      <td className="py-1.5 pr-3">{run.activity_date?.slice(0, 10) ?? '—'}</td>
                      <td className="py-1.5 pr-3">
                        {run.distance_meters != null ? (run.distance_meters / 1609.34).toFixed(2) + ' mi' : '—'}
                      </td>
                      <td className="py-1.5 pr-3">{formatPace(run.avg_pace_sec_per_km)}/mi</td>
                      <td className="py-1.5">{run.workout_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Latest check-in */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>
              Latest Check-in{runner.latestCheckin ? ` (${runner.latestCheckin.checkin_date})` : ''}
            </p>
            {runner.latestCheckin ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm" style={{ color: '#e2e2f0' }}>
                <span>Pain: <strong>{runner.latestCheckin.pain_level ?? '—'}</strong>/10</span>
                <span>Fatigue: <strong>{runner.latestCheckin.fatigue_level ?? '—'}</strong>/10</span>
                <span>Stress: <strong>{runner.latestCheckin.stress_level ?? '—'}</strong>/10</span>
                <span>Sleep: <strong>{runner.latestCheckin.sleep_hours ?? '—'}</strong> hrs</span>
                {runner.latestCheckin.soreness_notes && (
                  <span className="col-span-2 italic" style={{ color: '#9ca3af' }}>
                    &ldquo;{runner.latestCheckin.soreness_notes}&rdquo;
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#6b6b80' }}>No check-in on record.</p>
            )}
          </div>

          {/* Risk breakdown */}
          {runner.latestRisk && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>
                Risk Breakdown
              </p>
              <div className="text-sm space-y-1" style={{ color: '#e2e2f0' }}>
                <p>Global score: <strong>{runner.latestRisk.global_score}</strong> / 100</p>
                <p>Injury window: <strong>{runner.latestRisk.onset_days} days</strong></p>
                {runner.latestRisk.recommendations?.length ? (
                  <ul className="mt-1 space-y-1">
                    {runner.latestRisk.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-1.5" style={{ color: '#9ca3af' }}>
                        <span style={{ color: '#f97316' }}>•</span> {r}
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
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#f97316' }}>
                Unconfirmed Injuries
              </p>
              <div className="space-y-2">
                {injuries.map((inj) => (
                  <div
                    key={inj.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}
                  >
                    <div className="text-sm" style={{ color: '#e2e2f0' }}>
                      <p>{inj.injury_type ?? 'Injury reported'}{inj.body_location ? ` — ${inj.body_location}` : ''}</p>
                      {inj.reported_at && (
                        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{inj.reported_at.slice(0, 10)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleConfirmInjury(inj.id)}
                      disabled={confirmingId === inj.id}
                      className="ml-4 rounded-lg px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                      style={{ background: '#f97316' }}
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
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>
              Add Note
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Write a note for this runner…"
              style={inp}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSaveNote}
                disabled={saving || !note.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#f97316' }}
              >
                {saving ? 'Saving…' : 'Save Note'}
              </button>
              {noteSaved && <span className="text-xs" style={{ color: '#4ade80' }}>Note saved!</span>}
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
      <p className="px-4 py-6 text-sm" style={{ color: '#6b6b80', background: '#13131f' }}>
        No runners found for your team.
      </p>
    )
  }

  return (
    <div>
      {runners.map((runner) => (
        <RunnerRow key={runner.id} runner={runner} coachId={coachId} />
      ))}
    </div>
  )
}
