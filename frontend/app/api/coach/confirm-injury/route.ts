import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { injury_id } = body

  if (!injury_id) {
    return NextResponse.json({ error: 'injury_id is required' }, { status: 400 })
  }

  const supabase = createClient()

  const { error } = await supabase
    .from('injuries')
    .update({ confirmed_by_coach: true })
    .eq('id', injury_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
