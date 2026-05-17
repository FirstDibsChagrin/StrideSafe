'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PAIN_LOCATIONS = [
  'Knee', 'Shin', 'Ankle', 'Foot', 'Hip',
  'Hamstring', 'Quad', 'Calf', 'Back', 'IT Band'
]

interface Props {
  type: 'pre' | 'post'
  onClose: () => void
  onSaved: () => void
}

export default function CheckInModal({ type, onClose, onSaved }: Props) {
  const [painLevel, setPainLevel] = useState(0)
  const [fatigueLevel, setFatigueLevel] = useState(0)
  const [painLocations, setPainLocations] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const toggleLocation = (loc: string) => {
    setPainLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('run_checkins').insert({
      user_id: user.id,
      type,
      pain_level: painLevel,
      fatigue_level: fatigueLevel,
      pain_locations: painLocations,
      notes,
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  const label = (val: number, max: number) => {
    const pct = val / max
    if (pct === 0) return 'None'
    if (pct <= 0.3) return 'Low'
    if (pct <= 0.6) return 'Moderate'
    if (pct <= 0.8) return 'High'
    return 'Very High'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {type === 'pre' ? '🏃 Pre-Run Check-In' : '✅ Post-Run Check-In'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Pain Level */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Pain Level — <span className="text-orange-500">{painLevel}/10 ({label(painLevel, 10)})</span>
          </label>
          <input
            type="range" min={0} max={10} value={painLevel}
            onChange={e => setPainLevel(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>No pain</span><span>Worst pain</span>
          </div>
        </div>

        {/* Fatigue Level */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Fatigue Level — <span className="text-orange-500">{fatigueLevel}/10 ({label(fatigueLevel, 10)})</span>
          </label>
          <input
            type="range" min={0} max={10} value={fatigueLevel}
            onChange={e => setFatigueLevel(Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Fresh</span><span>Exhausted</span>
          </div>
        </div>

        {/* Pain Locations */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Pain Location <span className="font-normal text-gray-400">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PAIN_LOCATIONS.map(loc => (
              <button
                key={loc}
                onClick={() => toggleLocation(loc)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  painLocations.includes(loc)
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={type === 'pre' ? 'Anything feeling off today?' : 'How did the run feel?'}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Check-In'}
        </button>
      </div>
    </div>
  )
}
