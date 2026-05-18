import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import AccountMenu from '@/components/AccountMenu'
import CheckInCard from './CheckInCard'
import InjuryModal from './InjuryModal'
import SyncButton from './SyncButton'

interface Activity {
  strava_activity_id: string
  activity_date: string | null
  distance_meters: number | null
  duration_seconds: number | null
  avg_pace_sec_per_km: number | null
  workout_type: string | null
}

interface MetricRow {
  date: string
  acwr: number | null
  weekly_mileage_km: number | null
}

interface RiskScore {
  global_score: number
  severity_score: number
  onset_days: number
  recommendations: string[] | null
  date: string
}

interface Injury {
  id: string
  injury_type: string | null
  body_location: string | null
  start_date: string | null
  severity: number | null
  estimated_days_out: number | null
  confirmed_by_coach: boolean
  reported_at: string | null
}

function formatPace(secPerKm: number | null): string {
  if (!secPerKm) return '—'
  const secPerMile = secPerKm * 1.60934
  const min = Math.floor(secPerMile / 60)
  const sec = Math.round(secPerMile % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatDistance(meters: number | null): string {
  if (meters == null) return '—'
  return (meters / 1609.34).toFixed(2) + ' mi'
}

function riskRingColor(score: number) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f97316'
  return '#4ade80'
}

function riskLabel(score: number) {
  if (score >= 70) return 'High Risk'
  if (score >= 40) return 'Moderate Risk'
  return 'Low Risk'
}

function runDotColor(workoutType: string | null): string {
  if (!workoutType) return '#4ade80'
  const t = workoutType.toLowerCase()
  if (t.includes('race') || t.includes('interval') || t.includes('tempo')) return '#ef4444'
  if (t.includes('long') || t.includes('workout')) return '#f97316'
  return '#4ade80'
}

function RiskRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = riskRingColor(score)
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#2a2a3a" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{score}</text>
      <text x="60" y="70" textAnchor="middle" fontSize="10" fill="#6b6b80">/ 100</text>
    </svg>
  )
}

function AcwrBar({ acwr }: { acwr: number }) {
  const pct = Math.min((acwr / 2.0) * 100, 100)
  const underPct = (0.8 / 2.0) * 100
  const sweetPct = (1.3 / 2.0) * 100
  const acwrColor = acwr > 1.3 ? '#ef4444' : acwr < 0.8 ? '#facc15' : '#4ade80'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b6b80' }}>
          ACWR — Acute:Chronic Workload Ratio
        </span>
        <span className="text-sm font-bold" style={{ color: acwrColor }}>
          {acwr.toFixed(2)}
        </span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#1e1e2e' }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(to right, #facc15, #4ade80 40%, #4ade80 65%, #f97316 80%, #ef4444)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white"
          style={{
            left: `calc(${pct}% - 6px)`,
            background: acwrColor,
            boxShadow: `0 0 6px ${acwrColor}`,
          }}
        />
      </div>
      <div className="flex text-xs mt-1" style={{ color: '#6b6b80' }}>
        <span style={{ width: `${underPct}%` }}>Under-trained</span>
        <span style={{ width: `${sweetPct - underPct}%` }} className="text-center">Sweet spot</span>
        <span className="text-right flex-1">Danger zone</span>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stridesafe-production.up.railway.app'
  const stravaConnectUrl = `${apiUrl}/strava/connect?user_id=${user.id}`

  const [
    riskResult,
    metricsResult,
    activitiesResult,
    checkinResult,
    stravaResult,
    injuriesResult,
  ] = await Promise.all([
    supabase
      .from('risk_scores').select('*').eq('user_id', user.id)
      .order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from('training_metrics').select('date,acwr,weekly_mileage_km').eq('user_id', user.id)
      .order('date', { ascending: false }).limit(60),
    supabase
      .from('activities')
      .select('strava_activity_id,activity_date,distance_meters,duration_seconds,avg_pace_sec_per_km,workout_type')
      .eq('user_id', user.id).order('activity_date', { ascending: false }).limit(10),
    supabase
      .from('daily_checkins').select('id,pain_level,fatigue_level').eq('user_id', user.id)
      .eq('checkin_date', today).maybeSingle(),
    supabase.from('strava_connections').select('id').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('injuries')
      .select('id,injury_type,body_location,start_date,severity,estimated_days_out,confirmed_by_coach,reported_at')
      .eq('user_id', user.id).order('reported_at', { ascending: false }),
  ])

  const riskScore: RiskScore | null = riskResult.data
  const metrics: MetricRow[] = metricsResult.data ?? []
  const activities: Activity[] = activitiesResult.data ?? []
  const injuries: Injury[] = injuriesResult.data ?? []
  const todayCheckin = checkinResult.data as { pain_level?: number; fatigue_level?: number } | null
  const hasCheckedInToday = !!todayCheckin
  const hasStravaConnection = !!stravaResult.data

  const latestMetric = metrics[0] ?? null
  const currentAcwr = latestMetric?.acwr ?? 1.0
  const currentWeeklyKm = latestMetric?.weekly_mileage_km ?? 0
  const currentWeeklyMi = currentWeeklyKm * 0.621371
  const score = riskScore?.global_score ?? 0

  return (
    <div style={{ background: '#0d0d14', minHeight: '100vh' }}>

      {/* Top bar */}
      <div style={{ background: '#0d0d14', borderBottom: '1px solid #1e1e2e' }}>
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <span className="text-xl font-bold tracking-tight" style={{ color: '#f97316' }}>
            StrideSafe
          </span>
          <div className="flex items-center gap-3">
            <InjuryModal userId={user.id} />
            <SyncButton
              userId={user.id}
              hasStravaConnection={hasStravaConnection}
              stravaConnectUrl={stravaConnectUrl}
            />
            <AccountMenu email={user.email ?? ''} />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-6 space-y-5">

        {/* Injury Risk Card */}
        <div
          className="rounded-2xl p-6 flex items-center justify-between gap-6"
          style={{
            background: 'linear-gradient(135deg, #1a0a00, #2d1200)',
            border: '1px solid rgba(249,115,22,0.25)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(249,115,22,0.5)' }}>
              Injury Risk Score
            </p>
            {riskScore ? (
              <>
                <p className="text-6xl font-bold leading-none mb-2" style={{ color: riskRingColor(score) }}>
                  {score}
                  <span className="text-2xl font-normal ml-1" style={{ color: '#6b6b80' }}>/ 100</span>
                </p>
                <p className="text-base font-semibold mb-1" style={{ color: riskRingColor(score) }}>
                  {riskLabel(score)}
                </p>
                <p className="text-xs" style={{ color: '#6b6b80' }}>
                  Injury possible within {riskScore.onset_days} days · Updated {riskScore.date}
                </p>
                {riskScore.recommendations?.length ? (
                  <ul className="mt-3 space-y-1">
                    {riskScore.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="text-xs flex gap-2" style={{ color: '#e2e2f0' }}>
                        <span style={{ color: '#f97316' }}>›</span> {rec}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-sm mt-2" style={{ color: '#6b6b80' }}>
                Sync your runs to compute injury risk.
              </p>
            )}
          </div>
          <RiskRing score={score} />
        </div>

        {/* Check-In Card */}
        <CheckInCard />

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Weekly mi',
              value: currentWeeklyMi > 0 ? currentWeeklyMi.toFixed(1) : '—',
              sub: currentWeeklyMi > 50 ? '⚠ High volume' : currentWeeklyMi > 0 ? '✓ On track' : 'No data',
              subColor: currentWeeklyMi > 50 ? '#ef4444' : '#4ade80',
            },
            {
              label: 'ACWR',
              value: latestMetric ? currentAcwr.toFixed(2) : '—',
              sub: currentAcwr > 1.3 ? '⚠ Spike risk' : currentAcwr < 0.8 ? '↓ Under-trained' : '✓ Safe zone',
              subColor: currentAcwr > 1.3 || currentAcwr < 0.8 ? '#f97316' : '#4ade80',
            },
            {
              label: 'Runs logged',
              value: String(activities.length),
              sub: hasCheckedInToday ? '✓ Checked in today' : 'No check-in today',
              subColor: hasCheckedInToday ? '#4ade80' : '#6b6b80',
            },
          ].map(({ label, value, sub, subColor }) => (
            <div
              key={label}
              className="rounded-2xl p-4"
              style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b6b80' }}>
                {label}
              </p>
              <p className="text-2xl font-bold" style={{ color: '#e2e2f0' }}>{value}</p>
              <p className="text-xs mt-1" style={{ color: subColor }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ACWR Bar */}
        {latestMetric && (
          <div
            className="rounded-2xl p-5"
            style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
          >
            <AcwrBar acwr={currentAcwr} />
          </div>
        )}

        {/* Recent Runs */}
        <div
          className="rounded-2xl p-5"
          style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#6b6b80' }}>
            Recent Runs
          </p>
          {activities.length === 0 ? (
            <p className="text-sm" style={{ color: '#6b6b80' }}>
              No runs synced yet — connect Strava to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => {
                const dotColor = runDotColor(a.workout_type)
                return (
                  <div
                    key={a.strava_activity_id}
                    className="flex items-center gap-4 rounded-xl px-4 py-3"
                    style={{ background: '#1a1a2e', border: '1px solid #2a2a3a' }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#e2e2f0' }}>
                        {a.workout_type ?? 'Run'} · {a.activity_date?.slice(0, 10) ?? '—'}
                      </p>
                      <p className="text-xs" style={{ color: '#6b6b80' }}>
                        {formatDistance(a.distance_meters)} · {formatPace(a.avg_pace_sec_per_km)}/mi
                      </p>
                    </div>
                    {todayCheckin && a.activity_date?.slice(0, 10) === today && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs" style={{ color: '#6b6b80' }}>
                          Pain{' '}
                          <span style={{ color: (todayCheckin.pain_level ?? 0) > 5 ? '#ef4444' : '#4ade80' }}>
                            {todayCheckin.pain_level ?? 0}
                          </span>
                          {' · '}
                          Fatigue{' '}
                          <span style={{ color: (todayCheckin.fatigue_level ?? 0) > 5 ? '#f97316' : '#4ade80' }}>
                            {todayCheckin.fatigue_level ?? 0}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Active Injuries */}
        {injuries.length > 0 && (
          <div
            className="rounded-2xl p-5"
            style={{ background: '#13131f', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#ef4444' }}>
              Active Injuries
            </p>
            <div className="space-y-3">
              {injuries.map((injury) => (
                <div
                  key={injury.id}
                  className="flex items-start justify-between rounded-xl px-4 py-3"
                  style={{ background: '#1a0a0a', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold" style={{ color: '#e2e2f0' }}>
                      {injury.injury_type ?? 'Injury'}
                      {injury.body_location && (
                        <span className="font-normal" style={{ color: '#6b6b80' }}> — {injury.body_location}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: '#6b6b80' }}>
                      {injury.start_date && <span>Since {injury.start_date}</span>}
                      {injury.severity != null && <span>Severity {injury.severity}/10</span>}
                      {injury.estimated_days_out != null && <span>~{injury.estimated_days_out} days out</span>}
                    </div>
                  </div>
                  <span
                    className="mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      injury.confirmed_by_coach
                        ? { background: 'rgba(249,115,22,0.2)', color: '#f97316' }
                        : { background: '#1e1e2e', color: '#6b6b80' }
                    }
                  >
                    {injury.confirmed_by_coach ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
