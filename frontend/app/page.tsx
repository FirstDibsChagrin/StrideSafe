import Link from 'next/link'

export default function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: '#0d0d14' }}
    >
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight" style={{ color: '#f97316' }}>
          StrideSafe
        </h1>
        <p className="mt-3 text-lg" style={{ color: '#6b6b80' }}>
          Injury prediction for high school cross-country teams
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-xl px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#e2e2f0' }}
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          className="rounded-xl px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#f97316' }}
        >
          Sign Up
        </Link>
      </div>
    </main>
  )
}
