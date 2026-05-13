import { Suspense } from 'react'
import StravaCallbackInner from './StravaCallbackInner'

export default function StravaCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <Suspense fallback={<p className="text-gray-500">Connecting Strava…</p>}>
        <StravaCallbackInner />
      </Suspense>
    </main>
  )
}
