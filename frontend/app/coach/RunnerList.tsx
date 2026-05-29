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
  grip_strength_lbs: number | null
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
  latestRisk: { global_score: number; onset_days: number; recommendations: string[] | null; date: string } | null
  latestMetrics: { acwr: number | null; weekly_mileage_km: number | null; date: string } | null
  lastRuns: RunnerActivity[]
  latestCheckin: RunnerCheckin | null
  unconfirmedInjuries: RunnerInjury[]
}

interface RunnerListProps { runners: RunnerData[]; coachId: string }

function riskBadgeStyle(score: number): React.CSSProperties {
  if (score >= 70) return { background: 'rgba(239,68,68,0.15)', color: '#f87171' }
  if (score >= 40) return { background: 'rgba(250,204,21,0.12)', color: '#fbbf24' }
  return { background: 'rgba(74,222,128,0.12)', color: '#4ade80' }
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm) return '—'
  const secPerMile = secPerKm * 1.60934
  const min = Math.floor(secPerMile / 60)
  const sec = Math.round(secPerMile % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

const inp: React.CSSProperties = {
  background: '#0d0d14', border: '1px solid #2a2a3a', color: '#e2e2f0',
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
  const weeklyMi = runner.latestMetrics?.weekly_mileage_km != null
    ? (runner.latestMetrics.weekly_mileage_km * 0.621371).toFixed(1)
    : '—'

  const handleSaveNote = async () => {
    if (!note.trim()) return
    setSaving(true)
    try {
      await fetch('/api/coach/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runner_id: runner.id, coach_id: coachId, note }),
      })
      setNote(''); setNoteSaved(true)
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

  const checkin = runner.latestCheckin

  return (
    <div style={{ borderBottom: '1px solid #1a1a2e' }} className="last:border-b-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors"
        style={{ background: expanded ? '#111120' : '#13131f' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#111120' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = '#13131f' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate" style={{ color: '#e2e2f0' }}>
              {runner.full_name ?? 'Unknown'}
            </span>
            {score !== null && score > 70 && <span style={{ color: '#ef4444' }}>⚑</span>}
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>
            Synced: {runner.latestMetrics?.date ?? 'never'}
          </p>
        </div>

        <div className="flex-shrink-0 w-14 text-center">
          {score !== null ? (
            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={riskBadgeStyle(score)}>
              {score}
            </span>
          ) : <span style={{ color: '#3a3a50', fontSize: '12px' }}>—</span>}
        </div>

        <div className="flex-shrink-0 w-16 text-right">
          <p className="text-xs" style={{ color: '#6b6b80' }}>ACWR</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: '#e2e2f0' }}>
            {runner.latestMetrics?.acwr?.toFixed(2) ?? '—'}
          </p>
        </div>

        <div className="flex-shrink-0 w-20 text-right">
          <p className="text-xs" style={{ color: '#6b6b80' }}>Wk mi</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: '#e2e2f0' }}>{weeklyMi}</p>
        </div>

        <span className="flex-shrink-0 text-xs" style={{ color: '#6b6b80' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-5 space-y-5" style={{ background: '#0d0d14' }}>

          {/* Last 5 runs */}
          <div className="pt-4">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b6b80' }}>Last 5 Runs</p>
            {runner.lastRuns.length === 0 ? (
              <p className="text-sm" style={{ color: '#6b6b80' }}>No runs on record.</p>
            ) : (
              <div>
                {runner.lastRuns.map((run, i) => (
                  <div key={run.strava_activity_id} className="flex items-center gap-3 py-2"
                    style={{ borderTop: i > 0 ? '1px solid #111120' : undefined }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: '#e2e2f0' }}>
                        {run.workout_type ?? 'Run'} · <span style={{ color: '#6b6b80' }}>{run.activity_date?.slice(0, 10) ?? '—'}</span>
                      </p>
                    </div>
                    <p className="text-sm tabular-nums" style={{ color: '#e2e2f0' }}>
                      {run.distance_meters != null ? (run.distance_meters / 1609.34).toFixed(2) + ' mi' : '—'}
                    </p>
                    <p className="text-sm tabular-nums" style={{ color: '#6b6b80' }}>
                      {formatPace(run.avg_pace_sec_per_km)}/mi
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest check-in */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b6b80' }}>
              Check-In {checkin ? `— ${checkin.checkin_date}` : ''}
            </p>
            {checkin ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm" style={{ color: '#e2e2f0' }}>
                  <span>Pain: <strong>{checkin.pain_level ?? '—'}</strong>/10</span>
                  <span>Fatigue: <strong>{checkin.fatigue_level ?? '—'}</strong>/10</span>
                  <span>Stress: <strong>{checkin.stress_level ?? '—'}</strong>/10</span>
                  <span>Sleep: <strong>{checkin.sleep_hours ?? '—'}</strong> hrs</span>
                  {checkin.grip_strength_lbs != null && (
                    <span>Grip: <strong>{checkin.grip_strength_lbs}</strong> lbs</span>
                  )}
                </div>
                {checkin.soreness_notes && (
                  <p className="text-sm italic" style={{ color: '#9ca3af' }}>&ldquo;{checkin.soreness_notes}&rdquo;</p>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#6b6b80' }}>No check-in on record.</p>
            )}
          </div>

          {/* Risk breakdown */}
          {runner.latestRisk && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b6b80' }}>Risk Breakdown</p>
              <div className="text-sm space-y-1" style={{ color: '#e2e2f0' }}>
                <p>Global score: <strong>{runner.latestRisk.global_score}</strong>/100</p>
                <p>Injury window: <strong>{runner.latestRisk.onset_days} days</strong></p>
                {runner.latestRisk.recommendations?.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {runner.latestRisk.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2" style={{ color: '#9ca3af' }}>
                        <span style={{ color: '#f97316', flexShrink: 0 }}>›</span> {r}
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
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>
                Unconfirmed Injuries
              </p>
              <div className="space-y-2">
                {injuries.map((inj) => (
                  <div key={inj.id} className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)' }}>
                    <div className="text-sm" style={{ color: '#e2e2f0' }}>
                      <p>{inj.injury_type ?? 'Injury reported'}{inj.body_location ? ` — ${inj.body_location}` : ''}</p>
                      {inj.reported_at && (
                        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{inj.reported_at.slice(0, 10)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleConfirmInjury(inj.id)} disabled={confirmingId === inj.id}
                      className="ml-4 rounded-lg px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                      style={{ background: '#f97316' }}
                    >{confirmingId === inj.id ? 'Confirming…' : 'Confirm'}</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach note */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#6b6b80' }}>Add Note</p>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Write a note for this runner…" style={inp}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSaveNote} disabled={saving || !note.trim()}
                className="rounded-lg px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                style={{ background: '#f97316' }}
              >{saving ? 'Saving…' : 'Save Note'}</button>
              {noteSaved && <span className="text-xs" style={{ color: '#4ade80' }}>✓ Saved</span>}
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
      <p className="px-5 py-6 text-sm" style={{ color: '#6b6b80', background: '#13131f' }}>
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
