import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import OnboardingFlow from './OnboardingFlow'

export default async function OnboardingPage() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // If already onboarded, skip to dashboard
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.team_id) {
    redirect('/dashboard')
  }

  // Fetch all teams for the team-selection step
  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,school')
    .order('name', { ascending: true })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to StrideSafe</h1>
        <p className="mt-2 text-gray-500">Let&apos;s get your account set up in three quick steps.</p>
      </div>
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <OnboardingFlow userId={user.id} teams={teams ?? []} />
      </div>
    </main>
  )
}
