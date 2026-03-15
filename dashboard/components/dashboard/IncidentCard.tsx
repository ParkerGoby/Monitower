'use client'

import { useState } from 'react'
import { Incident, formatRelativeTime } from '@/types/monitower'
import { IncidentTimeline } from './IncidentTimeline'

interface IncidentCardProps {
  incident: Incident
}

const SEVERITY_BADGE: Record<string, string> = {
  warning: 'bg-yellow-700 text-yellow-200',
  critical: 'bg-red-700 text-red-200 animate-pulse',
}

export function IncidentCard({ incident }: IncidentCardProps) {
  const [showTimeline, setShowTimeline] = useState(false)

  return (
    <div
      data-testid={`incident-card-${incident.id}`}
      className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold rounded px-1.5 py-0.5 uppercase ${SEVERITY_BADGE[incident.severity] ?? 'bg-zinc-700 text-zinc-300'}`}
            >
              {incident.severity}
            </span>
            <span className="text-xs text-zinc-500">{formatRelativeTime(incident.startedAt)}</span>
          </div>
          <p className="text-sm text-zinc-100">{incident.rootCause}</p>
        </div>
      </div>

      {/* Affected services */}
      <div className="flex flex-wrap gap-1">
        {incident.affected.map((svc) => (
          <span key={svc} className="text-xs bg-zinc-800 text-zinc-300 rounded px-1.5 py-0.5">
            {svc}
          </span>
        ))}
      </div>

      <button
        data-testid="view-timeline-button"
        onClick={() => setShowTimeline((v) => !v)}
        className="text-xs text-zinc-400 hover:text-zinc-200 text-left transition-colors"
      >
        {showTimeline ? 'Hide Timeline ▲' : 'View Timeline ▼'}
      </button>

      {showTimeline && (
        <IncidentTimeline
          incidentId={incident.id}
          timeline={incident.timeline}
          startedAt={incident.startedAt}
        />
      )}
    </div>
  )
}
