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

  const {
    role,
    full_name,
    age,
    gender,
    team_id,
    create_team,
    team_name,
    team_school,
  } = body

  if (!role || !full_name) {
    return NextResponse.json({ error: 'role and full_name are required' }, { status: 400 })
  }

  let resolvedTeamId: string | null = team_id ?? null

  if (create_team) {
    if (!team_name || !team_school) {
      return NextResponse.json(
        { error: 'team_name and team_school are required when creating a team' },
        { status: 400 },
      )
    }

    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert({ name: team_name, school: team_school })
      .select('id')
      .single()

    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 400 })
    }

    resolvedTeamId = newTeam.id
  }

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      role,
      full_name,
      age: age ?? null,
      gender: gender ?? null,
      team_id: resolvedTeamId,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, team_id: resolvedTeamId })
}
