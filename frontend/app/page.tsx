import Link from 'next/link'

export default function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Background glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Badge */}
      <div
        className="flex items-center gap-2 rounded-full px-4 py-1.5 mb-10 text-xs font-semibold uppercase tracking-widest"
        style={{
          background: 'var(--orange-dim)',
          border: '1px solid var(--orange-border)',
          color: 'var(--orange)',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
          <circle cx="4" cy="4" r="4" />
        </svg>
        For High School Cross-Country
      </div>

      {/* Headline */}
      <h1
        className="text-center leading-none mb-5"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(44px, 7vw, 72px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--text-primary)',
          maxWidth: '640px',
        }}
      >
        Train smarter.{' '}
        <span style={{ color: 'var(--orange)' }}>Stay in the race.</span>
      </h1>

      {/* Subheading */}
      <p
        className="text-center mb-10"
        style={{
          color: 'var(--text-secondary)',
          fontSize: '16px',
          lineHeight: '1.7',
          maxWidth: '380px',
        }}
      >
        ML-powered injury prediction built for competitive runners and their coaches.
      </p>

      {/* CTAs */}
      <div className="flex gap-3 mb-16">
        <Link
          href="/signup"
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all"
          style={{
            background: 'var(--orange)',
            boxShadow: '0 0 24px rgba(249,115,22,0.3)',
          }}
          onMouseEnter={undefined}
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          Sign In
        </Link>
      </div>

      {/* Feature strip */}
      <div
        className="flex rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        {([
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            ),
            title: 'Risk Score',
            sub: 'ML-computed daily',
            color: 'var(--red)',
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            ),
            title: 'ACWR Tracking',
            sub: 'Catch spikes early',
            color: 'var(--amber)',
          },
          {
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
            title: 'Coach View',
            sub: 'Whole team at a glance',
            color: 'var(--violet)',
          },
        ] as const).map(({ icon, title, sub, color }, i) => (
          <div
            key={title}
            className="px-8 py-5 text-center"
            style={{ borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}
          >
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl mx-auto mb-3"
              style={{ background: 'var(--bg-elevated)', color }}
            >
              {icon}
            </div>
            <p
              className="text-sm font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
              {title}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
