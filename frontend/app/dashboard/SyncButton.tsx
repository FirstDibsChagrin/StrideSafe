'use client'

import { useState } from 'react'

interface SyncButtonProps {
  userId: string
  hasStravaConnection: boolean
  stravaConnectUrl: string
}

export default function SyncButton({ userId, hasStravaConnection, stravaConnectUrl }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stridesafe-production.up.railway.app'

  if (!hasStravaConnection) {
    return (
      <a
        href={stravaConnectUrl}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: '#FC4C02' }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        Connect Strava
      </a>
    )
  }

  const handleSync = async () => {
    setSyncing(true); setMessage(null)
    try {
      const res = await fetch(`${apiUrl}/strava/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      setMessage(res.ok ? `↑ ${data.synced} activities synced` : (data.detail ?? 'Sync failed'))
    } catch {
      setMessage('Sync failed — check connection')
    } finally { setSyncing(false) }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync} disabled={syncing}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ background: syncing ? '#ea6c0a' : '#f97316' }}
      >
        {syncing ? 'Syncing…' : 'Sync Runs'}
      </button>
      {message && <span className="text-xs" style={{ color: '#6b6b80' }}>{message}</span>}
    </div>
  )
}
