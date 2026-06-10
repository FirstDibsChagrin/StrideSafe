'use client'

import { useState } from 'react'

interface Props {
  onClose: () => void
  onSaved: () => void
}

const WORKOUT_TYPES = ['Run', 'Easy Run', 'Long Run', 'Tempo', 'Interval', 'Race', 'Trail Run']

const field: React.CSSProperties = {
  background: '#0d0d14', border: '1px solid #2a2a3a', color: '#e2e2f0',
  borderRadius: '12px', padding: '10px 12px', width: '100%', fontSize: '14px', outline: 'none',
}

export default function AddRunModal({ onClose, onSaved }: Props) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [distanceMi, setDistanceMi] = useState('')
  const [durationMin, setDurationMin] = useState('')
  const [durationSec, setDurationSec] = useState('')
  const [workoutType, setWorkoutType] = useState('Run')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const distNum = parseFloat(distanceMi)
  const totalSec = parseInt(durationMin || '0') * 60 + parseInt(durationSec || '0')
  const paceSecPerMi = distNum > 0 && totalSec > 0 ? totalSec / distNum : null
  const paceDisplay = paceSecPerMi
    ? `${Math.floor(paceSecPerMi / 60)}:${String(Math.round(paceSecPerMi % 60)).padStart(2, '0')} /mi`
    : null

  async function handleSave() {
    if (!distanceMi || isNaN(distNum) || distNum <= 0) { setError('Enter a valid distance'); return }
    if (totalSec <= 0) { setError('Enter a valid duration'); return }

    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          distance_miles: distNum,
          duration_seconds: totalSec,
          workout_type: workoutType,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save')
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md shadow-2xl sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>

        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #1e1e2e' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: '#e2e2f0' }}>Log a Run</h2>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>Add a run manually</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none hover:opacity-60" style={{ color: '#6b6b80' }}>×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b6b80' }}>Date</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)} style={field}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
            />
          </div>

          {/* Distance */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b6b80' }}>Distance</label>
            <div className="relative">
              <input
                type="number" min={0} step={0.01} value={distanceMi} placeholder="0.00"
                onChange={e => setDistanceMi(e.target.value)}
                style={{ ...field, paddingRight: '40px' }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#6b6b80' }}>mi</span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b6b80' }}>
              Duration
              {paceDisplay && <span className="ml-2 normal-case font-normal" style={{ color: '#f97316' }}>· {paceDisplay}</span>}
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="number" min={0} value={durationMin} placeholder="0"
                  onChange={e => setDurationMin(e.target.value)}
                  style={{ ...field, paddingRight: '44px' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#6b6b80' }}>min</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="number" min={0} max={59} value={durationSec} placeholder="0"
                  onChange={e => setDurationSec(e.target.value)}
                  style={{ ...field, paddingRight: '40px' }}
                  onFocus={e => (e.target.style.borderColor = '#f97316')}
                  onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#6b6b80' }}>sec</span>
              </div>
            </div>
          </div>

          {/* Workout type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#6b6b80' }}>Type</label>
            <div className="flex flex-wrap gap-2">
              {WORKOUT_TYPES.map(t => (
                <button key={t} onClick={() => setWorkoutType(t)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  style={workoutType === t
                    ? { background: '#f97316', color: '#fff' }
                    : { background: '#1e1e2e', color: '#9ca3af', border: '1px solid #2a2a3a' }}
                >{t}</button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 rounded-xl py-3 text-sm font-semibold"
              style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#f97316' }}>
              {saving ? 'Saving…' : 'Log Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
