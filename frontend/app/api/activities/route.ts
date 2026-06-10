import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { date, distance_miles, duration_seconds, workout_type } = body

  if (!date || !distance_miles || !duration_seconds) {
    return NextResponse.json({ error: 'date, distance_miles, and duration_seconds are required' }, { status: 400 })
  }

  const userClient = createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const distanceMeters = distance_miles * 1609.34
  const distanceKm = distanceMeters / 1000
  const avgPaceSecPerKm = distanceKm > 0 ? duration_seconds / distanceKm : 0

  // Negative timestamp IDs mark manual runs and won't conflict with Strava's positive IDs
  const manualActivityId = -(Date.now())

  const { error } = await supabase.from('activities').insert({
    user_id: user.id,
    strava_activity_id: manualActivityId,
    activity_date: date,
    distance_meters: distanceMeters,
    duration_seconds,
    avg_pace_sec_per_km: avgPaceSecPerKm,
    workout_type: workout_type ?? 'Run',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
  await Promise.allSettled([
    fetch(`${backendUrl}/metrics/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    }),
    fetch(`${backendUrl}/risk/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    }),
  ])

  return NextResponse.json({ success: true })
}
