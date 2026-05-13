'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const INJURY_TYPES = [
  'Shin Splints',
  'IT Band Syndrome',
  'Stress Fracture',
  'Plantar Fasciitis',
  'Achilles Tendinopathy',
  'Patellofemoral Pain',
  'Hamstring Strain',
  'Other',
]

interface InjuryModalProps {
  userId: string
}

export default function InjuryModal({ userId }: InjuryModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [injuryType, setInjuryType] = useState('')
  const [bodyLocation, setBodyLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [severity, setSeverity] = useState(5)
  const [estimatedDaysOut, setEstimatedDaysOut] = useState<number | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reset = () => {
    setInjuryType('')
    setBodyLocation('')
    setStartDate('')
    setSeverity(5)
    setEstimatedDaysOut('')
    setError(null)
  }

  const handleOpen = () => {
    reset()
    setOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!injuryType) {
      setError('Please select an injury type.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/injuries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          injury_type: injuryType,
          body_location: bodyLocation || null,
          start_date: startDate || null,
          severity,
          estimated_days_out: estimatedDaysOut !== '' ? estimatedDaysOut : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to report injury')
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
      >
        Report Injury
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Report an Injury</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Injury type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Injury type <span className="text-red-500">*</span>
                </label>
                <select
                  value={injuryType}
                  onChange={(e) => setInjuryType(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select…</option>
                  {INJURY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Body location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body location
                </label>
                <input
                  type="text"
                  value={bodyLocation}
                  onChange={(e) => setBodyLocation(e.target.value)}
                  placeholder="e.g. Left shin, right knee…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Start date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Severity slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">Severity</label>
                  <span className="text-sm font-semibold text-red-600">{severity}/10</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="w-full accent-red-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Mild</span>
                  <span>Severe</span>
                </div>
              </div>

              {/* Estimated days out */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated days out
                </label>
                <input
                  type="number"
                  min={0}
                  value={estimatedDaysOut}
                  onChange={(e) =>
                    setEstimatedDaysOut(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="e.g. 7"
                  className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? 'Reporting…' : 'Report Injury'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
