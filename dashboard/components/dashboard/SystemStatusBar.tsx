import { Incident, formatUptime } from '@/types/monitower'

interface SystemStatusBarProps {
  incidents: Incident[]
  activeFaults: string[]
  uptime: number
}

type Severity = 'healthy' | 'warning' | 'critical'

function computeSeverity(incidents: Incident[], activeFaults: string[]): Severity {
  const active = incidents.filter((i) => i.status === 'active')
  if (active.some((i) => i.severity === 'critical')) return 'critical'
  if (active.length > 0 || activeFaults.length > 0) return 'warning'
  return 'healthy'
}

const SEVERITY_STYLES: Record<Severity, string> = {
  healthy: 'border-zinc-700 text-green-400',
  warning: 'border-amber-700 text-amber-300',
  critical: 'border-red-700 text-red-300',
}

const SEVERITY_DOT: Record<Severity, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-amber-400 animate-pulse',
  critical: 'bg-red-500 animate-pulse',
}

export function SystemStatusBar({ incidents, activeFaults, uptime }: SystemStatusBarProps) {
  const severity = computeSeverity(incidents, activeFaults)
  const activeIncidents = incidents.filter((i) => i.status === 'active')

  let statusText: string
  if (severity === 'healthy') {
    statusText = 'All systems healthy'
  } else {
    const parts: string[] = []
    if (activeIncidents.length > 0) {
      parts.push(`${activeIncidents.length} active incident${activeIncidents.length !== 1 ? 's' : ''}`)
    }
    if (activeFaults.length > 0) {
      parts.push(`${activeFaults.map((f) => f).join(', ')} active`)
    }
    statusText = parts.join(' · ')
  }

  return (
    <div
      data-testid="system-status-bar"
      data-severity={severity}
      className={`flex items-center gap-3 px-4 py-2 border-b text-sm font-mono ${SEVERITY_STYLES[severity]}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[severity]}`} />
      <span className="font-semibold text-zinc-100">Monitower</span>
      <span className="text-zinc-400">·</span>
      <span>{statusText}</span>
      <span className="ml-auto text-zinc-500">↑ {formatUptime(uptime)}</span>
    </div>
  )
}
