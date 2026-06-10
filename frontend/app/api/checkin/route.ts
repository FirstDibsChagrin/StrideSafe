import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { pain_level, fatigue_level, stress_level, sleep_hours, soreness_notes, grip_strength_lbs } = body

  // Verify the caller is authenticated
  const userClient = createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role to bypass RLS
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('daily_checkins').upsert(
    {
      user_id: user.id,
      checkin_date: today,
      pain_level: pain_level ?? null,
      fatigue_level: fatigue_level ?? null,
      stress_level: stress_level ?? null,
      sleep_hours: sleep_hours ?? null,
      soreness_notes: soreness_notes ?? null,
      grip_strength_lbs: grip_strength_lbs ?? null,
    },
    { onConflict: 'user_id,checkin_date' },
  )

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
