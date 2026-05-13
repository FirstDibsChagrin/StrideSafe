'use client'

import { useState } from 'react'

export default function ConnectStravaButton() {
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/strava/auth`)
    const { url } = await res.json()
    window.location.href = url
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
    >
      {loading ? 'Redirecting…' : 'Connect Strava'}
    </button>
  )
}
