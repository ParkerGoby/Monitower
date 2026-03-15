'use client'

import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { HistoryPoint } from '@/hooks/useMetricHistory'

interface MetricSparklineProps {
  data: HistoryPoint[]
  color?: string
}

export function MetricSparkline({ data, color = '#f59e0b' }: MetricSparklineProps) {
  if (data.length === 0) {
    return <div className="h-10 bg-zinc-900 rounded" />
  }

  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill="url(#sparkGradient)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ background: '#18181b', border: 'none', fontSize: 10 }}
          formatter={(v) => [typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : String(v), 'error rate']}
          labelFormatter={() => ''}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
