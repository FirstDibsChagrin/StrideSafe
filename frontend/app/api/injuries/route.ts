import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { injury_type, body_location, start_date, severity, estimated_days_out } = body

  if (!injury_type) {
    return NextResponse.json({ error: 'injury_type is required' }, { status: 400 })
  }

  const { error } = await supabase.from('injuries').insert({
    user_id: user.id,
    injury_type,
    body_location: body_location ?? null,
    start_date: start_date ?? null,
    severity: severity ?? null,
    estimated_days_out: estimated_days_out ?? null,
    confirmed_by_coach: false,
    reported_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
