'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  type: 'pre' | 'post'
  onClose: () => void
  onSaved: () => void
}

const PAIN_LABELS = ['None', '', '', 'Mild', '', '', 'Moderate', '', '', 'Severe', 'Max']

const PAIN_LOCATIONS = [
  'Knee', 'Shin', 'Ankle', 'Foot', 'Hip',
  'Hamstring', 'Quad', 'Calf', 'Back', 'IT Band',
]

export default function CheckInModal({ type, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [pain, setPain] = useState(0)
  const [fatigue, setFatigue] = useState(0)
  const [stress, setStress] = useState(0)
  const [locations, setLocations] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleLocation(loc: string) {
    setLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const today = new Date().toISOString().split('T')[0]
      const { error: upsertError } = await supabase.from('daily_checkins').upsert(
        {
          user_id: user.id,
          checkin_date: today,
          checkin_type: type,
          pain_level: pain,
          fatigue_level: fatigue,
          stress_level: stress,
          notes: [
            notes.trim(),
            locations.length ? `Locations: ${locations.join(', ')}` : '',
          ].filter(Boolean).join(' | ') || null,
        },
        { onConflict: 'user_id,checkin_date' },
      )
      if (upsertError) throw upsertError
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-md p-6 shadow-xl sm:rounded-2xl rounded-t-2xl"
        style={{ background: '#13131f', border: '1px solid #2a2a3a' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: '#e2e2f0' }}>
            {type === 'pre' ? '🏃 Pre-Run Check-In' : '✅ Post-Run Check-In'}
          </h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none hover:opacity-70"
            style={{ color: '#6b6b80' }}
          >
            ×
          </button>
        </div>

        {/* Sliders */}
        {[
          { label: 'Pain level', value: pain, set: setPain },
          { label: 'Fatigue level', value: fatigue, set: setFatigue },
          { label: 'Stress level', value: stress, set: setStress },
        ].map(({ label, value, set }) => (
          <div key={label} className="mb-5">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold">
              <span style={{ color: '#e2e2f0' }}>{label}</span>
              <span style={{ color: '#6b6b80' }}>
                {value}/10{PAIN_LABELS[value] ? ` — ${PAIN_LABELS[value]}` : ''}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full accent-orange-500"
              style={{ accentColor: '#f97316' }}
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: '#6b6b80' }}>
              <span>0</span><span>10</span>
            </div>
          </div>
        ))}

        {/* Pain location pills */}
        {pain > 0 && (
          <div className="mb-5">
            <p className="text-sm font-semibold mb-2" style={{ color: '#e2e2f0' }}>
              Pain location{' '}
              <span className="font-normal" style={{ color: '#6b6b80' }}>(select all that apply)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {PAIN_LOCATIONS.map(loc => (
                <button
                  key={loc}
                  onClick={() => toggleLocation(loc)}
                  className="px-3 py-1 rounded-full text-sm transition-colors"
                  style={
                    locations.includes(loc)
                      ? { background: '#f97316', color: '#fff', border: '1px solid #f97316' }
                      : { background: '#1e1e2e', color: '#9ca3af', border: '1px solid #2a2a3a' }
                  }
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <textarea
          placeholder={type === 'pre' ? 'Anything feeling off today?' : 'How did the run feel?'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mb-4 w-full resize-none rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={{
            background: '#1e1e2e',
            border: '1px solid #2a2a3a',
            color: '#e2e2f0',
          }}
        />

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-3 text-sm font-semibold hover:opacity-80 transition-opacity"
            style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: saving ? '#ea6c0a' : '#f97316' }}
          >
            {saving ? 'Saving…' : 'Save Check-In'}
          </button>
        </div>
      </div>
    </div>
  )
}
