import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: '#0d0d14' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-8" style={{ color: '#f97316', letterSpacing: '0.2em' }}>
        For High School Cross-Country
      </p>

      <h1 className="text-6xl font-black tracking-tight text-center leading-none mb-5 max-w-xl" style={{ color: '#e2e2f0' }}>
        Train smarter.<br />
        <span style={{ color: '#f97316' }}>Stay in the race.</span>
      </h1>

      <p className="text-base text-center mb-12 max-w-sm" style={{ color: '#6b6b80', lineHeight: '1.8' }}>
        ML-powered injury prediction built for competitive runners and their coaches.
      </p>

      <div className="flex gap-3 mb-20">
        <Link
          href="/signup"
          className="px-10 py-3.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: '#f97316' }}
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-10 py-3.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: '#13131f', border: '1px solid #2a2a3a', color: '#9ca3af' }}
        >
          Sign In
        </Link>
      </div>

      {/* Feature strip */}
      <div
        className="flex divide-x rounded-2xl overflow-hidden"
        style={{ background: '#13131f', border: '1px solid #1e1e2e', divideColor: '#1e1e2e' } as React.CSSProperties}
      >
        {([
          ['Risk Score', 'ML-computed daily'],
          ['ACWR Tracking', 'Catch spikes early'],
          ['Coach View', 'Whole team at a glance'],
        ] as const).map(([title, sub], i) => (
          <div key={title} className="px-8 py-4 text-center" style={{ borderLeft: i > 0 ? '1px solid #1e1e2e' : 'none' }}>
            <p className="text-sm font-semibold" style={{ color: '#e2e2f0' }}>{title}</p>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>{sub}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
