export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="text-xl font-bold text-gray-900 tracking-tight">StrideSafe</span>
        <div className="flex gap-3">
          <a
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in
          </a>
          <a
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Sign up free
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-20 pb-24 max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 mb-6">
          🏃 Built for high school cross-country
        </span>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight tracking-tight sm:text-6xl">
          Predict injuries<br />before they happen
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-xl leading-relaxed">
          StrideSafe uses AI to analyse your training load and flag injury risk in real time —
          so runners stay healthy and coaches stay ahead. Free. Connects to Strava in seconds.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Sign up free
          </a>
          <a
            href="/login"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Sign in
          </a>
        </div>
      </section>

      {/* Feature cards */}
      <section className="bg-gray-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-gray-900 mb-12">
            Everything you need to train smarter
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-base font-semibold text-gray-900">Real-time risk scores</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                XGBoost model trained on competitive runner data scores your injury risk daily,
                factoring in workload, recovery, and how you feel.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-3xl mb-4">📋</div>
              <h3 className="text-base font-semibold text-gray-900">Coach dashboard</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Coaches see every runner's risk score, ACWR, and weekly mileage in one view —
                with flags for athletes who need attention before a problem develops.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-base font-semibold text-gray-900">Strava integration</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                Connect once and runs sync automatically via Strava webhooks — no manual
                uploads, no friction. Risk scores update the moment a new activity lands.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} StrideSafe — keeping runners on the road
      </footer>
    </main>
  )
}
