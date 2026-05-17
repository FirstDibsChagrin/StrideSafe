'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  type: 'pre' | 'post'
  onClose: () => void
  onSaved: () => void
}

const PAIN_LABELS = ['None', '', '', 'Mild', '', '', 'Moderate', '', '', 'Severe', 'Max']

export default function CheckInModal({ type, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [pain, setPain] = useState(0)
  const [fatigue, setFatigue] = useState(0)
  const [stress, setStress] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          notes: notes.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <h2 className="mb-5 text-lg font-bold text-gray-900">
          {type === 'pre' ? '🏃 Pre-Run Check-In' : '✅ Post-Run Check-In'}
        </h2>

        {[
          { label: 'Pain level', value: pain, set: setPain },
          { label: 'Fatigue level', value: fatigue, set: setFatigue },
          { label: 'Stress level', value: stress, set: setStress },
        ].map(({ label, value, set }) => (
          <div key={label} className="mb-5">
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-gray-700">
              <span>{label}</span>
              <span className="text-gray-400">
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
            />
          </div>
        ))}

        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mb-4 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
        />

        {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Check-In'}
          </button>
        </div>
      </div>
    </div>
  )
}
