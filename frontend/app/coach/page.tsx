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
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('role,team_id,full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!coachProfile || coachProfile.role !== 'coach') redirect('/dashboard')

  const teamId = coachProfile.team_id

  if (!teamId) {
    return (
      <main className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-10">
            <span
              className="text-xl font-black tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Stride<span style={{ color: 'var(--orange)' }}>Safe</span>
            </span>
            <AccountMenu email={user.email ?? ''} />
          </div>
          <div className="max-w-md">
            <div
              className="rounded-2xl p-8"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center justify-center w-12 h-12 rounded-2xl mb-5"
                style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange-border)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h1
                className="text-xl font-bold mb-1"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Create your team
              </h1>
              <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                Set up your team so runners can join and you can start tracking their training.
              </p>
              <CreateTeamForm />
            </div>
          </div>
        </div>
      </main>
    )
  }

  const { data: runnerProfiles } = await supabase
    .from('profiles')
    .select('id,full_name,role,team_id')
    .eq('team_id', teamId)
    .eq('role', 'runner')

  const runners: Profile[] = runnerProfiles ?? []
  const runnerIds = runners.map((r) => r.id)

  if (runnerIds.length === 0) {
    return (
      <main className="min-h-screen p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <span
                className="text-xl font-black tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
              >
                Stride<span style={{ color: 'var(--orange)' }}>Safe</span>
              </span>
              <p className="text-xs mt-0.5 uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
                Coach Dashboard
              </p>
            </div>
            <AccountMenu email={user.email ?? ''} />
          </div>
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="mx-auto mb-4" style={{ color: 'var(--border)' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No runners yet</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Share your team code with athletes to get started.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const [riskResult, metricsResult, activitiesResult, checkinResult, injuriesResult] =
    await Promise.all([
      supabase.from('risk_scores').select('*').in('user_id', runnerIds).order('date', { ascending: false }),
      supabase.from('training_metrics').select('user_id,acwr,weekly_mileage_km,date').in('user_id', runnerIds).order('date', { ascending: false }),
      supabase.from('activities').select('user_id,strava_activity_id,activity_date,distance_meters,avg_pace_sec_per_km,duration_seconds,workout_type').in('user_id', runnerIds).order('activity_date', { ascending: false }),
      supabase.from('daily_checkins').select('user_id,checkin_date,pain_level,fatigue_level,stress_level,sleep_hours,soreness_notes,grip_strength_lbs').in('user_id', runnerIds).order('checkin_date', { ascending: false }),
      supabase.from('injuries').select('id,user_id,injury_type,body_location,reported_at').in('user_id', runnerIds).eq('confirmed_by_coach', false),
    ])

  const allRiskScores = riskResult.data ?? []
  const allMetrics = metricsResult.data ?? []
  const allActivities = activitiesResult.data ?? []
  const allCheckins = checkinResult.data ?? []
  const allInjuries = injuriesResult.data ?? []

  const runnersData = runners
    .map((runner) => ({
      id: runner.id,
      full_name: runner.full_name,
      latestRisk: allRiskScores.find((r) => r.user_id === runner.id) ?? null,
      latestMetrics: allMetrics.find((m) => m.user_id === runner.id) ?? null,
      lastRuns: allActivities.filter((a) => a.user_id === runner.id).slice(0, 5),
      latestCheckin: allCheckins.find((c) => c.user_id === runner.id) ?? null,
      unconfirmedInjuries: allInjuries.filter((i) => i.user_id === runner.id),
    }))
    .sort((a, b) => (b.latestRisk?.global_score ?? -1) - (a.latestRisk?.global_score ?? -1))

  const highRiskCount = runnersData.filter(r => (r.latestRisk?.global_score ?? 0) >= 70).length
  const pendingInjuries = runnersData.reduce((sum, r) => sum + r.unconfirmedInjuries.length, 0)

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <div>
            <span
              className="text-xl font-black tracking-tight"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              Stride<span style={{ color: 'var(--orange)' }}>Safe</span>
            </span>
            <p className="text-xs mt-0.5 uppercase tracking-widest font-medium" style={{ color: 'var(--text-muted)' }}>
              Coach Dashboard
            </p>
          </div>
          <AccountMenu email={user.email ?? ''} />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-6 space-y-5">

        {/* Summary pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {runnersData.length} runner{runnersData.length !== 1 ? 's' : ''}
          </div>

          {highRiskCount > 0 && (
            <div
              className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--red-dim)', border: '1px solid var(--red-border)', color: 'var(--red)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {highRiskCount} high risk
            </div>
          )}

          {pendingInjuries > 0 && (
            <div
              className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange-border)', color: 'var(--orange)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {pendingInjuries} pending injur{pendingInjuries !== 1 ? 'ies' : 'y'}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--green)' }} />
            Low (&lt;40)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--amber)' }} />
            Moderate (40–70)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--red)' }} />
            High (&gt;70)
          </span>
        </div>

        {/* Runner list */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
        >
          {/* Table header */}
          <div
            className="flex items-center gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-widest"
            style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <div className="flex-1">Runner</div>
            <div className="w-16 text-center flex-shrink-0">Risk</div>
            <div className="w-16 text-right flex-shrink-0">ACWR</div>
            <div className="w-20 text-right flex-shrink-0">Wk mi</div>
            <div className="w-5 flex-shrink-0" />
          </div>
          <RunnerList runners={runnersData} coachId={user.id} />
        </div>
      </div>
    </main>
  )
}
