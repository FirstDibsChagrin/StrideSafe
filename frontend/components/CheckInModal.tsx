'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props { type: 'pre' | 'post'; onClose: () => void; onSaved: () => void }

const PAIN_LABELS = ['None', '', '', 'Mild', '', '', 'Moderate', '', '', 'Severe', 'Max']
const PAIN_LOCATIONS = ['Knee', 'Shin', 'Ankle', 'Foot', 'Hip', 'Hamstring', 'Quad', 'Calf', 'Back', 'IT Band']

function Slider({ label, value, set, color = '#f97316' }: { label: string; value: number; set: (v: number) => void; color?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: '#e2e2f0' }}>{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {value}<span className="font-normal text-xs" style={{ color: '#6b6b80' }}>/10{PAIN_LABELS[value] ? ` — ${PAIN_LABELS[value]}` : ''}</span>
        </span>
      </div>
      <input
        type="range" min={0} max={10} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full" style={{ accentColor: color }}
      />
      <div className="flex justify-between text-xs mt-1" style={{ color: '#4a4a60' }}>
        <span>0</span><span>10</span>
      </div>
    </div>
  )
}

function GripInput({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#6b6b80' }}>{label}</label>
      <div className="relative">
        <input
          type="number" min={0} max={250} step={1} value={value} placeholder="—"
          onChange={(e) => set(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm pr-10 focus:outline-none"
          style={{ background: '#0d0d14', border: '1px solid #2a2a3a', color: '#e2e2f0' }}
          onFocus={e => (e.target.style.borderColor = '#f97316')}
          onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: '#6b6b80' }}>lbs</span>
      </div>
    </div>
  )
}

export default function CheckInModal({ type, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [pain, setPain] = useState(0)
  const [fatigue, setFatigue] = useState(0)
  const [stress, setStress] = useState(0)
  const [locations, setLocations] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [grip, setGrip] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleLocation(loc: string) {
    setLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])
  }

  const gripNum = grip !== '' ? Number(grip) : null

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const today = new Date().toISOString().split('T')[0]

      // Core check-in — always saved, no grip column dependency
      const { error: upsertError } = await supabase.from('daily_checkins').upsert(
        {
          user_id: user.id,
          checkin_date: today,
          pain_level: pain,
          fatigue_level: fatigue,
          stress_level: stress,
          soreness_notes: [
            notes.trim(),
            locations.length ? `Locations: ${locations.join(', ')}` : '',
          ].filter(Boolean).join(' | ') || null,
        },
        { onConflict: 'user_id,checkin_date' },
      )
      if (upsertError) throw upsertError

      // Grip strength — saved separately so a missing column never blocks the check-in
      if (gripNum !== null) {
        await supabase.from('daily_checkins')
          .update({ grip_strength_lbs: gripNum })
          .eq('user_id', user.id)
          .eq('checkin_date', today)
      }

      onSaved(); onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md shadow-2xl sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[90vh]"
        style={{ background: '#13131f', border: '1px solid #2a2a3a' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4" style={{ borderBottom: '1px solid #1e1e2e' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: '#e2e2f0' }}>
              {type === 'pre' ? 'Pre-Run Check-In' : 'Post-Run Check-In'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#6b6b80' }}>
              {type === 'pre' ? 'How are you feeling before you head out?' : 'How did the run go?'}
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none hover:opacity-60" style={{ color: '#6b6b80' }}>×</button>
        </div>

        <div className="px-6 py-5">
          {/* Sliders */}
          <Slider label="Pain level" value={pain} set={setPain} color={pain >= 7 ? '#ef4444' : pain >= 4 ? '#f97316' : '#f97316'} />
          <Slider label="Fatigue level" value={fatigue} set={setFatigue} />
          <Slider label="Stress level" value={stress} set={setStress} color="#a78bfa" />

          {/* Pain locations */}
          {pain > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold mb-2" style={{ color: '#e2e2f0' }}>
                Pain location <span className="font-normal text-xs" style={{ color: '#6b6b80' }}>select all that apply</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {PAIN_LOCATIONS.map(loc => (
                  <button
                    key={loc} onClick={() => toggleLocation(loc)}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                    style={locations.includes(loc)
                      ? { background: '#f97316', color: '#fff' }
                      : { background: '#1e1e2e', color: '#9ca3af', border: '1px solid #2a2a3a' }}
                  >{loc}</button>
                ))}
              </div>
            </div>
          )}

          {/* Grip strength */}
          <div className="mb-5">
            <p className="text-sm font-semibold mb-1" style={{ color: '#e2e2f0' }}>
              Grip strength <span className="font-normal text-xs" style={{ color: '#6b6b80' }}>optional — squeeze test</span>
            </p>
            <GripInput label="Dominant hand" value={grip} set={setGrip} />
          </div>

          {/* Notes */}
          <textarea
            placeholder={type === 'pre' ? 'Anything feeling off today?' : 'How did the run feel?'}
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mb-4 w-full resize-none rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            style={{ background: '#0d0d14', border: '1px solid #2a2a3a', color: '#e2e2f0' }}
            onFocus={e => (e.target.style.borderColor = '#f97316')}
            onBlur={e => (e.target.style.borderColor = '#2a2a3a')}
          />

          {error && <p className="mb-3 text-xs" style={{ color: '#ef4444' }}>{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 rounded-xl py-3 text-sm font-semibold"
              style={{ background: '#1e1e2e', border: '1px solid #2a2a3a', color: '#9ca3af' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#f97316' }}>
              {saving ? 'Saving…' : 'Save Check-In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
