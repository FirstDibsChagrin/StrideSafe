'use client'

import { useState } from 'react'
import CheckInModal from '@/components/CheckInModal'

export default function CheckInCard() {
  const [checkInType, setCheckInType] = useState<'pre' | 'post' | null>(null)
  const [lastCheckin, setLastCheckin] = useState<{ type: string } | null>(null)

  return (
    <>
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Daily Check-In
          </p>
          {lastCheckin && (
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--green)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {lastCheckin.type}-run check-in saved
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {/* Pre-Run */}
          <button
            onClick={() => setCheckInType('pre')}
            className="flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-left"
            style={{
              background: 'var(--violet-dim)',
              border: '1px solid var(--violet-border)',
              color: 'var(--violet)',
            }}
            aria-label="Pre-run check-in"
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(167,139,250,0.15)' }}
            >
              {/* Running figure icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="13" cy="4" r="2" />
                <path d="m14.5 10.5-2 3.5H9l-2 4" />
                <path d="m14.5 10.5 2.5 4.5" />
                <path d="m8 18 1-4" />
                <path d="m13.5 14 1.5 3" />
              </svg>
            </span>
            <div>
              <p className="font-semibold">Pre-Run</p>
              <p className="text-xs font-normal mt-0.5" style={{ color: 'rgba(167,139,250,0.6)' }}>Before your workout</p>
            </div>
          </button>

          {/* Post-Run */}
          <button
            onClick={() => setCheckInType('post')}
            className="flex-1 flex items-center gap-3 px-4 py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 text-left"
            style={{
              background: 'var(--green-dim)',
              border: '1px solid var(--green-border)',
              color: 'var(--green)',
            }}
            aria-label="Post-run check-in"
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(34,197,94,0.15)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div>
              <p className="font-semibold">Post-Run</p>
              <p className="text-xs font-normal mt-0.5" style={{ color: 'rgba(34,197,94,0.6)' }}>After your workout</p>
            </div>
          </button>
        </div>
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
