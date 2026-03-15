export interface ServiceStatus {
  name: string
  throughput: number
  errorRate: number
  p50Latency: number
  p99Latency: number
  status: string
  activeFaults: string[]
}

export interface QueueStatus {
  name: string
  depth: number
  enqueueRate: number
  dequeueRate: number
  isDlq: boolean
}

export interface TimelineEvent {
  ts: number
  message: string
}

export interface Incident {
  id: number
  startedAt: number
  resolvedAt: number | null
  severity: 'warning' | 'critical'
  rootCause: string
  rootService: string
  affected: string[]
  faultType: string | null
  timeline: TimelineEvent[]
  status: 'active' | 'resolved'
}

export interface StateSnapshot {
  ts: number
  services: ServiceStatus[]
  queues: QueueStatus[]
  incidents: Incident[]
  baselineReady: boolean
}

export type StatusColor = 'green' | 'amber' | 'red'

export function getStatusColor(
  service: ServiceStatus,
  dlqDepth: number
): StatusColor {
  const { errorRate, p99Latency, activeFaults } = service
  if (
    errorRate > 0.2 ||
    p99Latency > 2000 ||
    dlqDepth > 10
  ) {
    return 'red'
  }
  if (
    errorRate >= 0.05 ||
    p99Latency > 500 ||
    (dlqDepth > 0 && dlqDepth <= 10) ||
    activeFaults.length > 0
  ) {
    return 'amber'
  }
  return 'green'
}

/** Maps a service name to its DLQ queue name, if any */
export const SERVICE_DLQ_MAP: Record<string, string> = {
  'payment-service': 'payment-dlq',
  'notification-service': 'notification-dlq',
}

/** Maps a service name to its outbound queue name, if any */
export const SERVICE_QUEUE_MAP: Record<string, string> = {
  'order-service': 'order-queue',
  'payment-service': 'payment-queue',
}

export function formatFaultName(key: string): string {
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function formatUptime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function formatRelativeTime(ms: number): string {
  const elapsed = Date.now() - ms
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function formatDuration(startMs: number, endMs: number): string {
  const elapsed = Math.floor((endMs - startMs) / 1000)
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
