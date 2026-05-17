'use client'

import { useState } from 'react'
import CheckInModal from '@/components/CheckInModal'

export default function CheckInCard() {
  const [checkInType, setCheckInType] = useState<'pre' | 'post' | null>(null)
  const [lastCheckin, setLastCheckin] = useState<{ type: string; time: string } | null>(null)

  return (
    <>
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-bold text-gray-800 mb-3">Run Check-In</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setCheckInType('pre')}
            className="flex-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            🏃 Pre-Run
          </button>
          <button
            onClick={() => setCheckInType('post')}
            className="flex-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            ✅ Post-Run
          </button>
        </div>
        {lastCheckin && (
          <p className="text-xs text-gray-400 mt-2 text-center">
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
