import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import SignOutButton from './SignOutButton'
import ConnectStravaButton from './ConnectStravaButton'

export default async function DashboardPage() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Runner Dashboard</h1>
            {user && <p className="text-sm text-gray-500">{user.email}</p>}
          </div>
          <SignOutButton />
        </div>
      </header>

      <section className="p-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900">Strava</h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect your Strava account to import training data.
          </p>
          <div className="mt-4">
            <ConnectStravaButton />
          </div>
        </div>
      </section>
    </main>
  )
}
