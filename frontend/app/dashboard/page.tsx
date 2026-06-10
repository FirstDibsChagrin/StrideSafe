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

function riskColor(score: number) {
  if (score >= 70) return 'var(--red)'
  if (score >= 40) return 'var(--amber)'
  return 'var(--green)'
}

function riskLabel(score: number) {
  if (score >= 70) return 'High Risk'
  if (score >= 40) return 'Moderate Risk'
  return 'Low Risk'
}

function riskDimColor(score: number) {
  if (score >= 70) return 'var(--red-dim)'
  if (score >= 40) return 'var(--amber-dim)'
  return 'var(--green-dim)'
}

function runDotColor(workoutType: string | null): string {
  if (!workoutType) return 'var(--green)'
  const t = workoutType.toLowerCase()
  if (t.includes('race') || t.includes('interval') || t.includes('tempo')) return 'var(--red)'
  if (t.includes('long') || t.includes('workout')) return 'var(--amber)'
  return 'var(--green)'
}

function AcwrBar({ acwr }: { acwr: number }) {
  const pct = Math.min((acwr / 2.0) * 100, 100)
  const acwrColor = acwr > 1.3 ? 'var(--red)' : acwr < 0.8 ? 'var(--amber)' : 'var(--green)'
  const acwrLabel = acwr > 1.3 ? 'Overreaching — reduce load' : acwr < 0.8 ? 'Under-trained — build gradually' : 'Sweet spot — keep it up'

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Acute:Chronic Workload Ratio
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{acwrLabel}</p>
        </div>
        <span
          className="text-2xl font-black tabular-nums"
          style={{ fontFamily: 'var(--font-display)', color: acwrColor }}
        >
          {acwr.toFixed(2)}
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(to right, var(--amber) 0%, var(--green) 40%, var(--green) 65%, var(--amber) 80%, var(--red) 100%)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow"
          style={{ left: `calc(${pct}% - 7px)`, background: acwrColor }}
        />
      </div>
      <div className="flex text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        <span className="flex-1">Under-trained</span>
        <span className="flex-1 text-center">Sweet spot</span>
        <span className="flex-1 text-right">Danger zone</span>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stridesafe-production.up.railway.app'
  const stravaConnectUrl = `${apiUrl}/strava/connect?user_id=${user.id}`

  const [riskResult, metricsResult, activitiesResult, checkinResult, stravaResult, injuriesResult] =
    await Promise.all([
      supabase.from('risk_scores').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('training_metrics').select('date,acwr,weekly_mileage_km').eq('user_id', user.id).order('date', { ascending: false }).limit(60),
      supabase.from('activities').select('strava_activity_id,activity_date,distance_meters,duration_seconds,avg_pace_sec_per_km,workout_type').eq('user_id', user.id).order('activity_date', { ascending: false }).limit(10),
      supabase.from('daily_checkins').select('id,pain_level,fatigue_level').eq('user_id', user.id).eq('checkin_date', today).maybeSingle(),
      supabase.from('strava_connections').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('injuries').select('id,injury_type,body_location,start_date,severity,estimated_days_out,confirmed_by_coach,reported_at').eq('user_id', user.id).order('reported_at', { ascending: false }),
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
  const currentWeeklyMi = (latestMetric?.weekly_mileage_km ?? 0) * 0.621371
  const score = riskScore?.global_score ?? 0
  const color = riskColor(score)
  const dimColor = riskDimColor(score)

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      {/* Top bar */}
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
        <div className="mx-auto max-w-2xl flex items-center justify-between px-5 py-4">
          <span
            className="text-xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Stride<span style={{ color: 'var(--orange)' }}>Safe</span>
          </span>
          <div className="flex items-center gap-2">
            <InjuryModal userId={user.id} />
            <SyncButton userId={user.id} hasStravaConnection={hasStravaConnection} stravaConnectUrl={stravaConnectUrl} />
            <AccountMenu email={user.email ?? ''} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 space-y-4">

        {/* Risk Score — hero card */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: 'var(--bg-card)', border: `1px solid var(--border)` }}
        >
          {/* Left accent */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: color }}
          />

          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
            Injury Risk Score
          </p>

          {riskScore ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-end gap-2 mb-2">
                  <span
                    className="text-7xl font-black leading-none tabular-nums"
                    style={{ fontFamily: 'var(--font-display)', color }}
                  >
                    {score}
                  </span>
                  <span className="text-xl font-light mb-2" style={{ color: 'var(--border)' }}>/100</span>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: dimColor, color }}
                >
                  <svg width="6" height="6" viewBox="0 0 6 6" fill="currentColor">
                    <circle cx="3" cy="3" r="3" />
                  </svg>
                  {riskLabel(score)}
                </span>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Injury window: {riskScore.onset_days} days · Updated {riskScore.date}
                </p>
              </div>

              {/* Ring */}
              <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0" style={{ opacity: 0.35 }}>
                <circle cx="44" cy="44" r="36" fill="none" stroke="var(--border)" strokeWidth="8" />
                <circle
                  cx="44" cy="44" r="36" fill="none" stroke={color} strokeWidth="8"
                  strokeDasharray={`${(score / 100) * 226} 226`}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                />
              </svg>
            </div>
          ) : (
            <div>
              <span className="text-7xl font-black leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--border)' }}>—</span>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Sync runs to compute your risk score</p>
            </div>
          )}

          {riskScore?.recommendations?.length ? (
            <div className="mt-5 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {riskScore.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="flex gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {rec}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Stats strip */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex">
            {[
              {
                label: 'Weekly Miles',
                value: currentWeeklyMi > 0 ? currentWeeklyMi.toFixed(1) : '—',
                sub: currentWeeklyMi > 50 ? 'High volume' : currentWeeklyMi > 0 ? 'On track' : 'No data yet',
                subColor: currentWeeklyMi > 50 ? 'var(--red)' : currentWeeklyMi > 0 ? 'var(--green)' : 'var(--text-muted)',
                icon: currentWeeklyMi > 50 ? '⚠' : currentWeeklyMi > 0 ? '✓' : null,
              },
              {
                label: 'ACWR',
                value: latestMetric ? currentAcwr.toFixed(2) : '—',
                sub: currentAcwr > 1.3 ? 'Spike risk' : currentAcwr < 0.8 ? 'Under-trained' : 'Safe zone',
                subColor: currentAcwr > 1.3 || currentAcwr < 0.8 ? 'var(--amber)' : 'var(--green)',
              },
              {
                label: 'Runs',
                value: String(activities.length),
                sub: hasCheckedInToday ? 'Checked in' : 'No check-in',
                subColor: hasCheckedInToday ? 'var(--green)' : 'var(--text-muted)',
              },
            ].map(({ label, value, sub, subColor }, i) => (
              <div
                key={label}
                className="flex-1 px-4 py-4 text-center"
                style={{ borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}
              >
                <p
                  className="text-3xl font-black tabular-nums"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                  {value}
                </p>
                <p className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: subColor }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Check-In */}
        <CheckInCard />

        {/* ACWR bar */}
        {latestMetric && (
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <AcwrBar acwr={currentAcwr} />
          </div>
        )}

        {/* Recent Runs */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Recent Runs
            </p>
            {activities.length > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{activities.length} synced</span>
            )}
          </div>

          {activities.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="mx-auto mb-3" style={{ color: 'var(--border)' }}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No runs synced yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Connect Strava to get started</p>
            </div>
          ) : (
            activities.map((a, i) => {
              const dotColor = runDotColor(a.workout_type)
              return (
                <div
                  key={a.strava_activity_id}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {a.workout_type ?? 'Easy Run'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {a.activity_date?.slice(0, 10) ?? '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {formatDistance(a.distance_meters)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatPace(a.avg_pace_sec_per_km)}/mi
                    </p>
                  </div>
                  {todayCheckin && a.activity_date?.slice(0, 10) === today && (
                    <div
                      className="text-right flex-shrink-0 pl-3"
                      style={{ borderLeft: '1px solid var(--border-subtle)' }}
                    >
                      <p className="text-xs" style={{ color: (todayCheckin.pain_level ?? 0) > 5 ? 'var(--red)' : 'var(--text-muted)' }}>
                        Pain {todayCheckin.pain_level ?? 0}
                      </p>
                      <p className="text-xs" style={{ color: (todayCheckin.fatigue_level ?? 0) > 5 ? 'var(--amber)' : 'var(--text-muted)' }}>
                        Fatigue {todayCheckin.fatigue_level ?? 0}
                      </p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Active Injuries */}
        {injuries.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--red-border)' }}
          >
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--red-border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--red)' }}>
                Active Injuries
              </p>
            </div>
            {injuries.map((injury, i) => (
              <div
                key={injury.id}
                className="flex items-start justify-between px-5 py-4"
                style={{ borderTop: i > 0 ? '1px solid var(--red-dim)' : undefined }}
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {injury.injury_type ?? 'Injury'}
                    {injury.body_location && (
                      <span className="font-normal" style={{ color: 'var(--text-secondary)' }}> — {injury.body_location}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {injury.start_date && <span>Since {injury.start_date}</span>}
                    {injury.severity != null && <span>Severity {injury.severity}/10</span>}
                    {injury.estimated_days_out != null && <span>~{injury.estimated_days_out} days out</span>}
                  </div>
                </div>
                <span
                  className="flex-shrink-0 ml-4 mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={injury.confirmed_by_coach
                    ? { background: 'var(--orange-dim)', color: 'var(--orange)' }
                    : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                >
                  {injury.confirmed_by_coach ? 'Confirmed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
