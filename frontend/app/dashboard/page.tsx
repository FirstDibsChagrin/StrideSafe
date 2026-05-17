import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import AccountMenu from '@/components/AccountMenu'
import ACWRChart from './ACWRChart'
import CheckInCard from './CheckInCard'
import CheckinForm from './CheckinForm'
import InjuryModal from './InjuryModal'
import SyncButton from './SyncButton'
import WeeklyMileageChart from './WeeklyMileageChart'

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
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function riskColorClass(score: number) {
  if (score >= 70) return 'text-red-600 bg-red-50 border-red-200'
  if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-green-600 bg-green-50 border-green-200'
}

function riskLabel(score: number) {
  if (score >= 70) return 'High Risk'
  if (score >= 40) return 'Moderate Risk'
  return 'Low Risk'
}

function processWeeklyData(metrics: MetricRow[]) {
  const weekMap = new Map<string, number>()

  for (const row of metrics) {
    const date = new Date(row.date + 'T00:00:00Z')
    const dayOfWeek = date.getUTCDay()
    const weekStart = new Date(date)
    weekStart.setUTCDate(date.getUTCDate() - dayOfWeek)
    const weekKey = weekStart.toISOString().split('T')[0]
    const km = row.weekly_mileage_km ?? 0
    if (km > (weekMap.get(weekKey) ?? 0)) {
      weekMap.set(weekKey, km)
    }
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, km]) => ({ week: week.slice(5), km: parseFloat(km.toFixed(1)) }))
}

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

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
      .from('risk_scores')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('training_metrics')
      .select('date,acwr,weekly_mileage_km')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(60),
    supabase
      .from('activities')
      .select(
        'strava_activity_id,activity_date,distance_meters,duration_seconds,avg_pace_sec_per_km,workout_type',
      )
      .eq('user_id', user.id)
      .order('activity_date', { ascending: false })
      .limit(10),
    supabase
      .from('daily_checkins')
      .select('id')
      .eq('user_id', user.id)
      .eq('checkin_date', today)
      .maybeSingle(),
    supabase
      .from('strava_connections')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('injuries')
      .select('id,injury_type,body_location,start_date,severity,estimated_days_out,confirmed_by_coach,reported_at')
      .eq('user_id', user.id)
      .order('reported_at', { ascending: false }),
  ])

  const riskScore: RiskScore | null = riskResult.data
  const metrics: MetricRow[] = metricsResult.data ?? []
  const activities: Activity[] = activitiesResult.data ?? []
  const injuries: Injury[] = injuriesResult.data ?? []
  const hasCheckedInToday = !!checkinResult.data
  const hasStravaConnection = !!stravaResult.data

  const acwrData = [...metrics]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map((r) => ({ date: r.date, acwr: r.acwr }))

  const weeklyData = processWeeklyData(metrics)

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Runner Dashboard</h1>
            <p className="text-sm text-gray-500">Training load &amp; injury risk overview</p>
          </div>
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

        {/* Risk Score + Recommendations */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div
            className={`col-span-1 rounded-xl border p-6 ${riskScore ? riskColorClass(riskScore.global_score) : 'border-gray-200 bg-white'}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
              Injury Risk Score
            </p>
            {riskScore ? (
              <>
                <p className="mt-2 text-7xl font-bold leading-none">{riskScore.global_score}</p>
                <p className="mt-2 text-sm font-semibold">{riskLabel(riskScore.global_score)}</p>
                <p className="mt-1 text-xs opacity-70">
                  Injury possible within {riskScore.onset_days} days
                </p>
                <p className="mt-0.5 text-xs opacity-50">Updated {riskScore.date}</p>
              </>
            ) : (
              <p className="mt-4 text-sm opacity-70">
                No risk data yet — sync your runs to get started.
              </p>
            )}
          </div>

          <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recommendations
            </p>
            {riskScore?.recommendations?.length ? (
              <ul className="mt-3 space-y-2">
                {riskScore.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-blue-500">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-400">
                {riskScore
                  ? 'No recommendations — keep up the great work!'
                  : 'Sync your runs to generate recommendations.'}
              </p>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              ACWR — Last 30 Days
            </p>
            <p className="mb-4 text-xs text-gray-300">Green band = safe zone (0.8–1.3)</p>
            <ACWRChart data={acwrData} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Weekly Mileage — Last 8 Weeks
            </p>
            <WeeklyMileageChart data={weeklyData} />
          </div>
        </div>

        {/* Check-In Card */}
        <CheckInCard />

        {/* Recent Runs */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Recent Runs
          </p>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400">
              No runs synced yet — connect Strava to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase text-gray-400">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Distance</th>
                    <th className="pb-2 pr-4">Pace</th>
                    <th className="pb-2 pr-4">Duration</th>
                    <th className="pb-2">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activities.map((a) => (
                    <tr key={a.strava_activity_id} className="text-gray-700">
                      <td className="py-2 pr-4">{a.activity_date?.slice(0, 10) ?? '—'}</td>
                      <td className="py-2 pr-4">
                        {a.distance_meters != null
                          ? (a.distance_meters / 1000).toFixed(2) + ' km'
                          : '—'}
                      </td>
                      <td className="py-2 pr-4">{formatPace(a.avg_pace_sec_per_km)}/km</td>
                      <td className="py-2 pr-4">{formatDuration(a.duration_seconds)}</td>
                      <td className="py-2">{a.workout_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Injuries */}
        {injuries.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-white p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-orange-500">
              Active Injuries
            </p>
            <div className="space-y-3">
              {injuries.map((injury) => (
                <div
                  key={injury.id}
                  className="flex items-start justify-between rounded-lg border border-orange-100 bg-orange-50 px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900">
                      {injury.injury_type ?? 'Injury'}
                      {injury.body_location && (
                        <span className="font-normal text-gray-500"> — {injury.body_location}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      {injury.start_date && <span>Since {injury.start_date}</span>}
                      {injury.severity != null && (
                        <span>Severity {injury.severity}/10</span>
                      )}
                      {injury.estimated_days_out != null && (
                        <span>~{injury.estimated_days_out} days out</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      injury.confirmed_by_coach
                        ? 'bg-orange-200 text-orange-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {injury.confirmed_by_coach ? 'Confirmed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Check-in */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Daily Check-in
          </p>
          <CheckinForm userId={user.id} hasCheckedInToday={hasCheckedInToday} />
        </div>
      </div>
    </main>
  )
}
