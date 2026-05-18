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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role,team_id,full_name')
    .eq('id', user.id)
    .maybeSingle()

  // Already fully onboarded — send to dashboard
  if (profile?.team_id) {
    redirect(profile.role === 'coach' ? '/coach' : '/dashboard')
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,school')
    .order('name', { ascending: true })

  const lockedRole = (profile?.role as 'runner' | 'coach' | null) ?? null

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{ background: '#0d0d14' }}
    >
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold" style={{ color: '#f97316' }}>Welcome to StrideSafe</h1>
        <p className="mt-2 text-sm" style={{ color: '#9ca3af' }}>
          Let&apos;s get your account set up.
        </p>
      </div>
      <div
        className="w-full max-w-lg rounded-2xl p-8"
        style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
      >
        <OnboardingFlow userId={user.id} teams={teams ?? []} lockedRole={lockedRole} />
      </div>
    </main>
  )
}
