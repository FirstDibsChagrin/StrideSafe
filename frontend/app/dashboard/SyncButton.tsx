'use client'

import { useState } from 'react'

interface SyncButtonProps {
  userId: string
  hasStravaConnection: boolean
  stravaConnectUrl: string
}

const BACKEND_UNAVAILABLE_MSG =
  'Strava sync is coming soon — the backend is not yet deployed. Your data will sync once the server is live.'

export default function SyncButton({
  userId,
  hasStravaConnection,
  stravaConnectUrl,
}: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)

  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const backendReady = backendUrl.startsWith('https://')

  if (!hasStravaConnection) {
    if (!backendReady) {
      return (
        <p className="max-w-xs text-sm text-gray-400 italic">{BACKEND_UNAVAILABLE_MSG}</p>
      )
    }
    return (
      <a
        href={stravaConnectUrl}
        className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
      >
        Connect Strava
      </a>
    )
  }

  const handleSync = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch(`${backendUrl}/strava/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Synced ${data.synced} activities`)
      } else {
        setMessage(data.detail ?? 'Sync failed')
      }
    } catch {
      setMessage(!backendReady ? BACKEND_UNAVAILABLE_MSG : 'Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {syncing ? 'Syncing…' : 'Sync Runs'}
      </button>
      {message && (
        <span className={`max-w-xs text-sm ${message === BACKEND_UNAVAILABLE_MSG ? 'italic text-gray-400' : 'text-gray-500'}`}>
          {message}
        </span>
      )}
    </div>
  )
}
