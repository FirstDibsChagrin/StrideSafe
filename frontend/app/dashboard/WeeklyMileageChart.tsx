'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface WeeklyDataPoint {
  week: string
  km: number
}

interface WeeklyMileageChartProps {
  data: WeeklyDataPoint[]
}

export default function WeeklyMileageChart({ data }: WeeklyMileageChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No mileage data yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => [`${v.toFixed(1)} km`, 'Weekly Mileage']} />
        <Bar dataKey="km" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
