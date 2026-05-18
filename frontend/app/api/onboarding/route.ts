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

  const { role, full_name, team_id, create_team, team_name, team_school } = body

  if (!role) {
    return NextResponse.json({ error: 'role is required' }, { status: 400 })
  }

  let resolvedTeamId: string | null = team_id ?? null

  if (create_team) {
    if (!team_name) {
      return NextResponse.json(
        { error: 'team_name is required when creating a team' },
        { status: 400 },
      )
    }

    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: team_name,
        school: team_school || null,
        ...(role === 'coach' ? { coach_id: user.id } : {}),
      })
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
      email: user.email,
      role,
      ...(full_name ? { full_name } : {}),
      team_id: resolvedTeamId,
    },
    { onConflict: 'id' },
  )

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  // For runners joining a team, record them in team_members
  if (role === 'runner' && resolvedTeamId) {
    await supabase
      .from('team_members')
      .upsert({ team_id: resolvedTeamId, user_id: user.id }, { onConflict: 'team_id,user_id' })
  }

  return NextResponse.json({ success: true, team_id: resolvedTeamId })
}
