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
  miles: number
}

interface WeeklyMileageChartProps {
  data: WeeklyDataPoint[]
}

export default function WeeklyMileageChart({ data }: WeeklyMileageChartProps) {
  if (data.length === 0) {
    return <p className="text-sm py-8 text-center" style={{ color: '#6b6b80' }}>No mileage data yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#6b6b80' }} />
        <YAxis tick={{ fontSize: 10, fill: '#6b6b80' }} />
        <Tooltip formatter={(v: number) => [`${v.toFixed(1)} mi`, 'Weekly Mileage']} />
        <Bar dataKey="miles" fill="#f97316" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
