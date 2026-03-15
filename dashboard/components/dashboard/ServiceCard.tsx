'use client'

import { ServiceStatus, QueueStatus, getStatusColor, SERVICE_DLQ_MAP, SERVICE_QUEUE_MAP } from '@/types/monitower'
import { DLQBadge } from './DLQBadge'
import { QueueDepthBar } from './QueueDepthBar'
import { MetricSparkline } from './MetricSparkline'
import { useMetricHistory } from '@/hooks/useMetricHistory'

interface ServiceCardProps {
  service: ServiceStatus
  queues: QueueStatus[]
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400 animate-pulse',
  red: 'bg-red-500 animate-pulse',
}

const CARD_BORDER_CLASSES: Record<string, string> = {
  green: 'border-zinc-700',
  amber: 'border-amber-500',
  red: 'border-red-500',
}

function ServiceLabel({ name }: { name: string }) {
  const label = name
    .replace('-service', '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return <>{label} Service</>
}

export function ServiceCard({ service, queues }: ServiceCardProps) {
  const history = useMetricHistory(service.name)

  const dlqName = SERVICE_DLQ_MAP[service.name]
  const dlqQueue = dlqName ? queues.find((q) => q.name === dlqName) : undefined
  const dlqDepth = dlqQueue?.depth ?? 0

  const outboundQueueName = SERVICE_QUEUE_MAP[service.name]
  const outboundQueue = outboundQueueName ? queues.find((q) => q.name === outboundQueueName) : undefined

  const statusColor = getStatusColor(service, dlqDepth)

  return (
    <div
      data-testid={`service-card-${service.name}`}
      className={`rounded-lg border p-3 bg-zinc-900 flex flex-col gap-2 ${CARD_BORDER_CLASSES[statusColor]}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            data-testid={`status-dot-${service.name}`}
            data-status={statusColor}
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT_CLASSES[statusColor]}`}
          />
          <span className="text-sm font-semibold text-zinc-100">
            <ServiceLabel name={service.name} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          {service.activeFaults.map((f) => (
            <span key={f} className="text-xs bg-amber-900 text-amber-300 rounded px-1.5 py-0.5">
              {f}
            </span>
          ))}
          {dlqName && <DLQBadge serviceName={service.name} depth={dlqDepth} />}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-1">
        <Stat label="thruput" value={`${service.throughput.toFixed(1)}`} unit="/s" />
        <Stat label="err rate" value={`${(service.errorRate * 100).toFixed(1)}`} unit="%" />
        <Stat label="p50" value={`${Math.round(service.p50Latency)}`} unit="ms" />
        <Stat label="p99" value={`${Math.round(service.p99Latency)}`} unit="ms" />
      </div>

      {/* Queue depth bar */}
      {outboundQueue && <QueueDepthBar queue={outboundQueue} />}

      {/* Sparkline */}
      <MetricSparkline data={history} />
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center bg-zinc-800 rounded px-1 py-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-sm font-mono text-zinc-100">
        {value}
        <span className="text-xs text-zinc-400">{unit}</span>
      </span>
    </div>
  )
}
