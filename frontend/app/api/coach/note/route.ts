import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { runner_id, coach_id, note } = body

  if (!runner_id || !coach_id || !note) {
    return NextResponse.json({ error: 'runner_id, coach_id, and note are required' }, { status: 400 })
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('coach_notes')
    .insert({ runner_id, coach_id, note })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, note: data })
}
