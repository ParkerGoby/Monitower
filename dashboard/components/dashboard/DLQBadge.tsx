interface DLQBadgeProps {
  serviceName: string
  depth: number
}

export function DLQBadge({ serviceName, depth }: DLQBadgeProps) {
  return (
    <span
      data-testid={`dlq-badge-${serviceName}`}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold bg-red-600 text-white ${depth === 0 ? 'invisible' : ''}`}
    >
      {depth}
    </span>
  )
}
