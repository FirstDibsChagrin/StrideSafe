import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.name) {
    return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: newTeam, error: teamError } = await supabase
    .from('teams')
    .insert({ name: body.name, school: body.school ?? null, coach_id: user.id })
    .select('id')
    .single()

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 400 })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ team_id: newTeam.id })
    .eq('id', user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, team_id: newTeam.id })
}
