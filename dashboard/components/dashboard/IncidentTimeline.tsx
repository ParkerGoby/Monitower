import { TimelineEvent } from '@/types/monitower'

interface IncidentTimelineProps {
  incidentId: number
  timeline: TimelineEvent[]
  startedAt: number
}

function formatOffset(startMs: number, eventMs: number): string {
  const diffSec = Math.max(0, Math.floor((eventMs - startMs) / 1000))
  const m = Math.floor(diffSec / 60)
  const s = diffSec % 60
  return `+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function IncidentTimeline({ incidentId, timeline, startedAt }: IncidentTimelineProps) {
  return (
    <ol
      data-testid={`incident-timeline-${incidentId}`}
      className="flex flex-col gap-2 mt-2 pl-2 border-l border-zinc-700"
    >
      {timeline.map((event, i) => (
        <li key={i} className="flex flex-col gap-0.5">
          <span className="text-xs font-mono text-zinc-500">
            {formatOffset(startedAt, event.ts)}
          </span>
          <span className="text-xs text-zinc-300">{event.message}</span>
        </li>
      ))}
    </ol>
  )
}
