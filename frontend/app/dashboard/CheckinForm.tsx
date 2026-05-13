'use client'

import { useState } from 'react'

interface CheckinFormProps {
  userId: string
  hasCheckedInToday: boolean
}

function RangeSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{value}/10</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>0</span>
        <span>10</span>
      </div>
    </div>
  )
}

export default function CheckinForm({ userId, hasCheckedInToday }: CheckinFormProps) {
  const [pain, setPain] = useState(0)
  const [fatigue, setFatigue] = useState(0)
  const [stress, setStress] = useState(0)
  const [sleep, setSleep] = useState(8)
  const [soreness, setSoreness] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hasCheckedInToday) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        You have already checked in today. See you tomorrow!
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Check-in submitted successfully. Your risk score has been updated.
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          pain_level: pain,
          fatigue_level: fatigue,
          stress_level: stress,
          sleep_hours: sleep,
          soreness_notes: soreness,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Submission failed')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <RangeSlider label="Pain Level" value={pain} onChange={setPain} />
      <RangeSlider label="Fatigue Level" value={fatigue} onChange={setFatigue} />
      <RangeSlider label="Stress Level" value={stress} onChange={setStress} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sleep Hours</label>
        <input
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={sleep}
          onChange={(e) => setSleep(Number(e.target.value))}
          className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Soreness Notes</label>
        <textarea
          value={soreness}
          onChange={(e) => setSoreness(e.target.value)}
          rows={3}
          placeholder="Describe any soreness or discomfort..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? 'Submitting…' : 'Submit Check-in'}
      </button>
    </form>
  )
}
