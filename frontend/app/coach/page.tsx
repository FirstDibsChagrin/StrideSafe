import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import AccountMenu from '@/components/AccountMenu'
import RunnerList from './RunnerList'
import CreateTeamForm from './CreateTeamForm'

interface Profile {
  id: string
  full_name: string | null
  role: string | null
  team_id: string | null
}

export default async function CoachPage() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get coach's own profile
  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('role,team_id,full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!coachProfile || coachProfile.role !== 'coach') {
    redirect('/dashboard')
  }

  const teamId = coachProfile.team_id

  if (!teamId) {
    return (
      <main className="min-h-screen p-6" style={{ background: '#0d0d14' }}>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <span className="text-xl font-bold tracking-tight" style={{ color: '#f97316' }}>
              StrideSafe
            </span>
            <AccountMenu email={user.email ?? ''} />
          </div>
          <div
            className="rounded-2xl p-8 max-w-md"
            style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
          >
            <h1 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>Create your team</h1>
            <p className="mt-1 text-sm" style={{ color: '#9ca3af' }}>
              You don&apos;t have a team yet. Create one so your runners can join.
            </p>
            <CreateTeamForm />
          </div>
        </div>
      </main>
    )
  }

  // Fetch all runners on this team
  const { data: runnerProfiles } = await supabase
    .from('profiles')
    .select('id,full_name,role,team_id')
    .eq('team_id', teamId)
    .eq('role', 'runner')

  const runners: Profile[] = runnerProfiles ?? []
  const runnerIds = runners.map((r) => r.id)

  if (runnerIds.length === 0) {
    return (
      <main className="min-h-screen p-6" style={{ background: '#0d0d14' }}>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <span className="text-xl font-bold tracking-tight" style={{ color: '#f97316' }}>StrideSafe</span>
            <AccountMenu email={user!.email ?? ''} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#e2e2f0' }}>Coach Dashboard</h1>
          <p className="mt-4 text-sm" style={{ color: '#6b6b80' }}>No runners on your team yet.</p>
        </div>
      </main>
    )
  }

  // Batch fetch all runner data
  const [riskResult, metricsResult, activitiesResult, checkinResult, injuriesResult] =
    await Promise.all([
      supabase
        .from('risk_scores')
        .select('*')
        .in('user_id', runnerIds)
        .order('date', { ascending: false }),
      supabase
        .from('training_metrics')
        .select('user_id,acwr,weekly_mileage_km,date')
        .in('user_id', runnerIds)
        .order('date', { ascending: false }),
      supabase
        .from('activities')
        .select(
          'user_id,strava_activity_id,activity_date,distance_meters,avg_pace_sec_per_km,duration_seconds,workout_type',
        )
        .in('user_id', runnerIds)
        .order('activity_date', { ascending: false }),
      supabase
        .from('daily_checkins')
        .select(
          'user_id,checkin_date,pain_level,fatigue_level,stress_level,sleep_hours,soreness_notes',
        )
        .in('user_id', runnerIds)
        .order('checkin_date', { ascending: false }),
      supabase
        .from('injuries')
        .select('id,user_id,injury_type,body_location,reported_at')
        .in('user_id', runnerIds)
        .eq('confirmed_by_coach', false),
    ])

  const allRiskScores = riskResult.data ?? []
  const allMetrics = metricsResult.data ?? []
  const allActivities = activitiesResult.data ?? []
  const allCheckins = checkinResult.data ?? []
  const allInjuries = injuriesResult.data ?? []

  // Assemble per-runner data
  const runnersData = runners
    .map((runner) => {
      const latestRisk =
        allRiskScores.find((r) => r.user_id === runner.id) ?? null
      const latestMetrics =
        allMetrics.find((m) => m.user_id === runner.id) ?? null
      const lastRuns = allActivities
        .filter((a) => a.user_id === runner.id)
        .slice(0, 5)
      const latestCheckin =
        allCheckins.find((c) => c.user_id === runner.id) ?? null
      const unconfirmedInjuries = allInjuries.filter(
        (i) => i.user_id === runner.id,
      )

      return {
        id: runner.id,
        full_name: runner.full_name,
        latestRisk,
        latestMetrics,
        lastRuns,
        latestCheckin,
        unconfirmedInjuries,
      }
    })
    // Sort by risk score descending (nulls last)
    .sort(
      (a, b) =>
        (b.latestRisk?.global_score ?? -1) - (a.latestRisk?.global_score ?? -1),
    )

  return (
    <main className="min-h-screen p-6" style={{ background: '#0d0d14' }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xl font-bold tracking-tight" style={{ color: '#f97316' }}>StrideSafe</span>
            <p className="text-sm mt-0.5" style={{ color: '#6b6b80' }}>
              {runnersData.length} runner{runnersData.length !== 1 ? 's' : ''} on your team
            </p>
          </div>
          <AccountMenu email={user!.email ?? ''} />
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs" style={{ color: '#6b6b80' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400"></span> Low (&lt;40)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400"></span> Moderate (40–70)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400"></span> High (&gt;70)
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: '#ef4444' }}>⚑</span> Flag = risk &gt; 70
          </span>
        </div>

        {/* Runner list */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a3a' }}>
          {/* Table header */}
          <div
            className="flex items-center gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{ background: '#13131f', borderBottom: '1px solid #2a2a3a', color: '#6b6b80' }}
          >
            <div className="flex-1">Runner</div>
            <div className="flex-shrink-0 w-16 text-center">Risk</div>
            <div className="flex-shrink-0 w-16 text-right">ACWR</div>
            <div className="flex-shrink-0 w-20 text-right">Wk mi</div>
            <div className="flex-shrink-0 w-4"></div>
          </div>
          <RunnerList runners={runnersData} coachId={user!.id} />
        </div>
      </div>
    </main>
  )
}
