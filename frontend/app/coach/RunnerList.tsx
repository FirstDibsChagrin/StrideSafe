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
  if (score >= 70) return { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-border)' }
  if (score >= 40) return { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.2)' }
  return { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green-border)' }
}

function riskDot(score: number) {
  if (score >= 70) return 'var(--red)'
  if (score >= 40) return 'var(--amber)'
  return 'var(--green)'
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm) return '—'
  const secPerMile = secPerKm * 1.60934
  const min = Math.floor(secPerMile / 60)
  const sec = Math.round(secPerMile % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// Chevron icon
function ChevronIcon({ down }: { down: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--text-muted)', transform: down ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// Metric pill
function MetricPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="flex flex-col items-center px-3 py-2 rounded-xl text-center"
      style={{ background: 'var(--bg-elevated)', minWidth: '72px' }}
    >
      <span className="text-lg font-black tabular-nums" style={{ fontFamily: 'var(--font-display)', color: color ?? 'var(--text-primary)' }}>
        {value}
      </span>
      <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
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

  const checkin = runner.latestCheckin

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }} className="last:border-b-0">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: expanded ? 'var(--bg-card-hover)' : 'var(--bg-card)' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'var(--bg-card)' }}
        aria-expanded={expanded}
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{
            background: score !== null ? `${riskDot(score)}20` : 'var(--bg-elevated)',
            color: score !== null ? riskDot(score) : 'var(--text-muted)',
            border: `1px solid ${score !== null ? `${riskDot(score)}40` : 'var(--border)'}`,
          }}
        >
          {(runner.full_name ?? 'U').charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate text-sm" style={{ color: 'var(--text-primary)' }}>
              {runner.full_name ?? 'Unknown'}
            </span>
            {score !== null && score >= 70 && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="High risk flag">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {injuries.length > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}
              >
                {injuries.length}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Last sync: {runner.latestMetrics?.date ?? 'never'}
          </p>
        </div>

        {/* Risk badge */}
        <div className="w-14 text-center flex-shrink-0">
          {score !== null ? (
            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={riskBadgeStyle(score)}>
              {score}
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
          )}
        </div>

        {/* ACWR */}
        <div className="w-16 text-right flex-shrink-0">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ACWR</p>
          <p className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {runner.latestMetrics?.acwr?.toFixed(2) ?? '—'}
          </p>
        </div>

        {/* Weekly mi */}
        <div className="w-20 text-right flex-shrink-0">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Wk mi</p>
          <p className="text-sm font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {weeklyMi}
          </p>
        </div>

        <ChevronIcon down={expanded} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-6 space-y-6" style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)' }}>

          {/* Quick stats */}
          <div className="flex gap-3 pt-5 flex-wrap">
            {score !== null && (
              <MetricPill label="Risk" value={String(score)} color={riskDot(score)} />
            )}
            {runner.latestMetrics?.acwr != null && (
              <MetricPill
                label="ACWR"
                value={runner.latestMetrics.acwr.toFixed(2)}
                color={runner.latestMetrics.acwr > 1.3 ? 'var(--red)' : runner.latestMetrics.acwr < 0.8 ? 'var(--amber)' : 'var(--green)'}
              />
            )}
            {checkin?.pain_level != null && (
              <MetricPill label="Pain" value={`${checkin.pain_level}/10`} color={(checkin.pain_level ?? 0) > 5 ? 'var(--red)' : 'var(--green)'} />
            )}
            {checkin?.fatigue_level != null && (
              <MetricPill label="Fatigue" value={`${checkin.fatigue_level}/10`} color={(checkin.fatigue_level ?? 0) > 6 ? 'var(--amber)' : 'var(--text-secondary)'} />
            )}
            {checkin?.sleep_hours != null && (
              <MetricPill label="Sleep" value={`${checkin.sleep_hours}h`} color={(checkin.sleep_hours ?? 8) < 6 ? 'var(--amber)' : 'var(--text-secondary)'} />
            )}
            {checkin?.grip_strength_lbs != null && (
              <MetricPill label="Grip" value={`${checkin.grip_strength_lbs}`} />
            )}
          </div>

          {/* Notes */}
          {checkin?.soreness_notes && (
            <div
              className="rounded-xl px-4 py-3 text-sm italic"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              &ldquo;{checkin.soreness_notes}&rdquo;
            </div>
          )}

          {/* Last 5 runs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Last 5 Runs
            </p>
            {runner.lastRuns.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No runs on record.</p>
            ) : (
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
              >
                {runner.lastRuns.map((run, i) => (
                  <div
                    key={run.strava_activity_id}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{
                      background: 'var(--bg-card)',
                      borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {run.workout_type ?? 'Easy Run'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {run.activity_date?.slice(0, 10) ?? '—'}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                      {run.distance_meters != null ? (run.distance_meters / 1609.34).toFixed(2) + ' mi' : '—'}
                    </p>
                    <p className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {formatPace(run.avg_pace_sec_per_km)}/mi
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk recommendations */}
          {runner.latestRisk?.recommendations?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Recommendations
              </p>
              <div className="space-y-2">
                {runner.latestRisk.recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className="flex-shrink-0 mt-0.5" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Unconfirmed injuries */}
          {injuries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--orange)' }}>
                Unconfirmed Injuries
              </p>
              <div className="space-y-2">
                {injuries.map((inj) => (
                  <div
                    key={inj.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange-border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {inj.injury_type ?? 'Injury reported'}
                        {inj.body_location && (
                          <span style={{ color: 'var(--text-secondary)' }}> — {inj.body_location}</span>
                        )}
                      </p>
                      {inj.reported_at && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Reported {inj.reported_at.slice(0, 10)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleConfirmInjury(inj.id)}
                      disabled={confirmingId === inj.id}
                      className="ml-4 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--orange)' }}
                    >
                      {confirmingId === inj.id ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                          </svg>
                          Confirming…
                        </span>
                      ) : 'Confirm'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach note */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Add Note
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Write a note for this runner…"
              className="w-full rounded-xl px-4 py-3 text-sm transition-colors resize-none"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--orange)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSaveNote}
                disabled={saving || !note.trim()}
                className="rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-opacity disabled:opacity-40"
                style={{ background: 'var(--orange)' }}
              >
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                    </svg>
                    Saving…
                  </span>
                ) : 'Save Note'}
              </button>
              {noteSaved && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--green)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </span>
              )}
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
      <div className="px-5 py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No runners found for your team.</p>
      </div>
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
