import { Incident, formatDuration } from '@/types/monitower'
import { IncidentCard } from './IncidentCard'

interface IncidentPanelProps {
  incidents: Incident[]
}

export function IncidentPanel({ incidents }: IncidentPanelProps) {
  const active = incidents.filter((i) => i.status === 'active')
  const recent = incidents
    .filter((i) => i.status === 'resolved')
    .slice(0, 5)

  return (
    <div data-testid="incident-panel" className="flex flex-col gap-3">
      {/* Active incidents */}
      {active.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Active Incidents
          </h2>
          <div className="flex flex-col gap-2">
            {active.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        </section>
      )}

      {/* Recent incidents */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Recent Incidents
          </h2>
          <div data-testid="recent-incidents" className="flex flex-col gap-2">
            {recent.map((incident) => (
              <RecentIncidentRow key={incident.id} incident={incident} />
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && recent.length === 0 && (
        <p className="text-sm text-zinc-500 italic">No incidents recorded</p>
      )}
    </div>
  )
}

function RecentIncidentRow({ incident }: { incident: Incident }) {
  const shortId = String(incident.id).slice(0, 6)
  const truncated =
    incident.rootCause.length > 60
      ? incident.rootCause.slice(0, 60) + '…'
      : incident.rootCause

  const duration =
    incident.resolvedAt != null
      ? formatDuration(incident.startedAt, incident.resolvedAt)
      : null

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-zinc-500">#{shortId}</span>
        {incident.faultType && (
          <span className="text-xs bg-zinc-800 text-zinc-400 rounded px-1.5 py-0.5">
            {incident.faultType}
          </span>
        )}
        {duration && (
          <span className="text-xs text-zinc-500 ml-auto">resolved after {duration}</span>
        )}
      </div>
      <p className="text-xs text-zinc-300">{truncated}</p>
    </div>
  )
}
