'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

interface MetricPoint {
  date: string
  acwr: number | null
}

interface ACWRChartProps {
  data: MetricPoint[]
}

export default function ACWRChart({ data }: ACWRChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No training data yet.</p>
  }

  const chartData = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: row.date.slice(5),
      acwr: row.acwr != null ? parseFloat(row.acwr.toFixed(2)) : null,
    }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[0, 2.2]} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => [v.toFixed(2), 'ACWR']} />
        {/* Safe zone band */}
        <ReferenceArea y1={0.8} y2={1.3} fill="#22c55e" fillOpacity={0.08} />
        <ReferenceLine y={0.8} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} />
        <ReferenceLine y={1.3} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="acwr"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
