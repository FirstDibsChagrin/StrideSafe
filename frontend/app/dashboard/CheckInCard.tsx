'use client'

import { useState } from 'react'
import CheckInModal from '@/components/CheckInModal'

export default function CheckInCard() {
  const [checkInType, setCheckInType] = useState<'pre' | 'post' | null>(null)
  const [lastCheckin, setLastCheckin] = useState<{ type: string; time: string } | null>(null)

  return (
    <>
      <div
        className="rounded-2xl p-5"
        style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
      >
        <h3 className="font-bold mb-3" style={{ color: '#e2e2f0' }}>Run Check-In</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setCheckInType('pre')}
            className="flex-1 font-semibold py-3 rounded-xl transition-colors text-sm"
            style={{
              background: '#1a1230',
              border: '1px solid rgba(109,40,217,0.3)',
              color: '#a78bfa',
            }}
          >
            🏃 Pre-Run
          </button>
          <button
            onClick={() => setCheckInType('post')}
            className="flex-1 font-semibold py-3 rounded-xl transition-colors text-sm"
            style={{
              background: '#0d1f12',
              border: '1px solid rgba(22,163,74,0.3)',
              color: '#4ade80',
            }}
          >
            ✅ Post-Run
          </button>
        </div>
        {lastCheckin && (
          <p className="text-xs mt-2 text-center" style={{ color: '#6b6b80' }}>
            Last: {lastCheckin.type}-run check-in saved {lastCheckin.time}
          </p>
        )}
      </div>

      {checkInType && (
        <CheckInModal
          type={checkInType}
          onClose={() => setCheckInType(null)}
          onSaved={() => setLastCheckin({ type: checkInType, time: 'just now' })}
        />
      )}
    </>
  )
}
