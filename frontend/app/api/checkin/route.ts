import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { user_id, pain_level, fatigue_level, stress_level, sleep_hours, soreness_notes } = body

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('daily_checkins').insert({
    user_id,
    pain_level,
    fatigue_level,
    stress_level,
    sleep_hours,
    soreness_notes,
    checkin_date: today,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

  await Promise.allSettled([
    fetch(`${backendUrl}/metrics/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    }),
    fetch(`${backendUrl}/risk/compute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id }),
    }),
  ])

  return NextResponse.json({ success: true })
}
