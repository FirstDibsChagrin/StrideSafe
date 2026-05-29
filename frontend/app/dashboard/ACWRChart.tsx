'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface MetricPoint { date: string; acwr: number | null }
interface ACWRChartProps { data: MetricPoint[] }

export default function ACWRChart({ data }: ACWRChartProps) {
  if (data.length === 0) {
    return <p className="text-sm py-8 text-center" style={{ color: '#6b6b80' }}>No training data yet.</p>
  }

  const chartData = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ date: row.date.slice(5), acwr: row.acwr != null ? parseFloat(row.acwr.toFixed(2)) : null }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b6b80' }} interval="preserveStartEnd" />
        <YAxis domain={[0, 2.2]} tick={{ fontSize: 10, fill: '#6b6b80' }} />
        <Tooltip
          contentStyle={{ background: '#13131f', border: '1px solid #2a2a3a', borderRadius: '10px', color: '#e2e2f0' }}
          formatter={(v: number) => [v.toFixed(2), 'ACWR']}
        />
        <ReferenceArea y1={0.8} y2={1.3} fill="#22c55e" fillOpacity={0.06} />
        <ReferenceLine y={0.8} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
        <ReferenceLine y={1.3} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
        <Line type="monotone" dataKey="acwr" stroke="#f97316" strokeWidth={2} dot={false} connectNulls={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
