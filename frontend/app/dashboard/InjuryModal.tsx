'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const INJURY_TYPES = [
  'Shin Splints', 'IT Band Syndrome', 'Stress Fracture',
  'Plantar Fasciitis', 'Achilles Tendinopathy', 'Patellofemoral Pain',
  'Hamstring Strain', 'Other',
]

const inp: React.CSSProperties = {
  background: '#0d0d14', border: '1px solid #2a2a3a', color: '#e2e2f0',
  borderRadius: '10px', padding: '10px 14px', width: '100%', fontSize: '14px', outline: 'none',
}

interface InjuryModalProps { userId: string }

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reset = () => {
    setInjuryType(''); setBodyLocation(''); setStartDate(''); setSeverity(5); setEstimatedDaysOut(''); setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!injuryType) { setError('Please select an injury type.'); return }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/injuries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId, injury_type: injuryType,
          body_location: bodyLocation || null, start_date: startDate || null,
          severity, estimated_days_out: estimatedDaysOut !== '' ? estimatedDaysOut : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to report injury')
      }
      setOpen(false); router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
      >
        <span className="text-base leading-none">⚑</span> Report Injury
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false) }}
        >
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#e2e2f0' }}>Report an Injury</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>This will notify your coach for review</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-2xl leading-none hover:opacity-60" style={{ color: '#6b6b80' }}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>
                  Injury type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={injuryType}
                  onChange={(e) => setInjuryType(e.target.value)}
                  style={{ ...inp, appearance: 'none' }}
                  onFocus={e => (e.target.style.borderColor = '#ef4444')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                >
                  <option value="">Select…</option>
                  {INJURY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>Body location</label>
                <input
                  type="text" value={bodyLocation} onChange={(e) => setBodyLocation(e.target.value)}
                  placeholder="e.g. Left shin, right knee…" style={inp}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>Start date</label>
                <input
                  type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  style={{ ...inp, width: 'auto', colorScheme: 'dark' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b6b80' }}>Severity</label>
                  <span className="text-sm font-bold" style={{ color: severity >= 7 ? '#ef4444' : severity >= 4 ? '#f97316' : '#4ade80' }}>
                    {severity}/10
                  </span>
                </div>
                <input
                  type="range" min={1} max={10} step={1} value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="w-full" style={{ accentColor: '#ef4444' }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: '#6b6b80' }}>
                  <span>Mild</span><span>Severe</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>Estimated days out</label>
                <input
                  type="number" min={0} value={estimatedDaysOut} placeholder="e.g. 7"
                  onChange={(e) => setEstimatedDaysOut(e.target.value === '' ? '' : Number(e.target.value))}
                  style={{ ...inp, width: '7rem' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
              </div>

              {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                  style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
                >Cancel</button>
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: '#ef4444' }}
                >{submitting ? 'Reporting…' : 'Report Injury'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
