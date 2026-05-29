'use client'

import { useState } from 'react'
import CheckInModal from '@/components/CheckInModal'

export default function CheckInCard() {
  const [checkInType, setCheckInType] = useState<'pre' | 'post' | null>(null)
  const [lastCheckin, setLastCheckin] = useState<{ type: string } | null>(null)

  return (
    <>
      <div className="rounded-2xl p-5" style={{ background: '#13131f', border: '1px solid #1e1e2e' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#6b6b80' }}>
          Daily Check-In
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setCheckInType('pre')}
            className="flex-1 flex flex-col items-center gap-1 py-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa' }}
          >
            <span className="text-2xl">🏃</span>
            <span>Pre-Run</span>
          </button>
          <button
            onClick={() => setCheckInType('post')}
            className="flex-1 flex flex-col items-center gap-1 py-4 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
          >
            <span className="text-2xl">✓</span>
            <span>Post-Run</span>
          </button>
        </div>
        {lastCheckin && (
          <p className="text-xs mt-3 text-center" style={{ color: '#4ade80' }}>
            ✓ {lastCheckin.type}-run check-in saved
          </p>
        )}
      </div>

      {checkInType && (
        <CheckInModal
          type={checkInType}
          onClose={() => setCheckInType(null)}
          onSaved={() => setLastCheckin({ type: checkInType })}
        />
      )}
    </>
  )
}
