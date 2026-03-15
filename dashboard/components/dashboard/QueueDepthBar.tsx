import { QueueStatus } from '@/types/monitower'

interface QueueDepthBarProps {
  queue: QueueStatus
  maxDepth?: number
}

function barColor(depth: number, maxDepth: number, isDlq: boolean): string {
  if (isDlq) return 'bg-red-500'
  const ratio = depth / maxDepth
  if (ratio > 0.6) return 'bg-red-500'
  if (ratio > 0.25) return 'bg-yellow-400'
  return 'bg-zinc-500'
}

export function QueueDepthBar({ queue, maxDepth = 200 }: QueueDepthBarProps) {
  const pct = Math.min((queue.depth / maxDepth) * 100, 100)
  const color = barColor(queue.depth, maxDepth, queue.isDlq)

  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-xs text-zinc-400 truncate">{queue.name}</span>
        <span className="text-xs text-zinc-500 ml-auto">{Math.round(queue.depth)}</span>
      </div>
      <div className="h-1.5 w-full rounded bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 mt-0.5">
        ↑ {queue.enqueueRate.toFixed(1)}/s &nbsp; ↓ {queue.dequeueRate.toFixed(1)}/s
      </p>
    </div>
  )
}
