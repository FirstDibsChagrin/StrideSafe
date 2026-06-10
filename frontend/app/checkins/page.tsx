import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import AccountMenu from '@/components/AccountMenu'

interface Checkin {
  id: string
  checkin_date: string
  pain_level: number | null
  fatigue_level: number | null
  stress_level: number | null
  sleep_hours: number | null
  soreness_notes: string | null
  grip_strength_lbs: number | null
}

function levelColor(v: number | null) {
  if (v == null) return '#6b6b80'
  if (v >= 7) return '#ef4444'
  if (v >= 4) return '#f97316'
  return '#4ade80'
}

function StatPill({ label, value, unit = '/10' }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="text-center">
      <p className="text-xs mb-0.5" style={{ color: '#6b6b80' }}>{label}</p>
      <p className="text-lg font-bold leading-none" style={{ color: levelColor(value) }}>
        {value ?? '—'}
        {value != null && <span className="text-xs font-normal" style={{ color: '#4a4a60' }}>{unit}</span>}
      </p>
    </div>
  )
}

export default async function CheckinsPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data } = await supabase
    .from('daily_checkins')
    .select('id,checkin_date,pain_level,fatigue_level,stress_level,sleep_hours,soreness_notes,grip_strength_lbs')
    .eq('user_id', user.id)
    .order('checkin_date', { ascending: false })
    .limit(90)

  const checkins: Checkin[] = data ?? []

  return (
    <div style={{ background: '#0d0d14', minHeight: '100vh' }}>
      <div style={{ background: '#0d0d14', borderBottom: '1px solid #1e1e2e' }}>
        <div className="mx-auto max-w-2xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: '#6b6b80' }}
            >
              ← Dashboard
            </Link>
            <span className="text-lg font-black tracking-tight" style={{ color: '#e2e2f0' }}>
              Stride<span style={{ color: '#f97316' }}>Safe</span>
            </span>
          </div>
          <AccountMenu email={user.email ?? ''} />
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: '#e2e2f0' }}>Check-In History</h1>
          <p className="text-sm mt-1" style={{ color: '#6b6b80' }}>
            {checkins.length} check-in{checkins.length !== 1 ? 's' : ''} on record
          </p>
        </div>

        {checkins.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
            <p className="text-sm" style={{ color: '#6b6b80' }}>
              No check-ins yet. Use the Pre-Run or Post-Run buttons on your dashboard.
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm font-semibold"
              style={{ color: '#f97316' }}
            >
              Go to Dashboard →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {checkins.map((c) => {
              const weekday = new Date(c.checkin_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
              const highAlert = (c.pain_level ?? 0) >= 7 || (c.fatigue_level ?? 0) >= 7

              return (
                <div
                  key={c.id}
                  className="rounded-2xl p-5"
                  style={{
                    background: '#13131f',
                    border: `1px solid ${highAlert ? 'rgba(239,68,68,0.3)' : '#2a2a3a'}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-sm font-bold" style={{ color: '#e2e2f0' }}>{c.checkin_date}</span>
                      <span className="ml-2 text-xs" style={{ color: '#6b6b80' }}>{weekday}</span>
                    </div>
                    {highAlert && (
                      <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        High stress
                      </span>
                    )}
                  </div>

                  <div className="flex gap-6">
                    <StatPill label="Pain" value={c.pain_level} />
                    <StatPill label="Fatigue" value={c.fatigue_level} />
                    <StatPill label="Stress" value={c.stress_level} />
                    {c.grip_strength_lbs != null && (
                      <StatPill label="Grip" value={c.grip_strength_lbs} unit=" lbs" />
                    )}
                    {c.sleep_hours != null && (
                      <StatPill label="Sleep" value={c.sleep_hours} unit=" hrs" />
                    )}
                  </div>

                  {c.soreness_notes && (
                    <p className="mt-3 text-xs leading-relaxed" style={{ color: '#9ca3af' }}>
                      {c.soreness_notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
