'use client'

import { formatFaultName } from '@/types/monitower'

interface FaultStatusIndicatorProps {
  activeFaults: string[]
  injectedAt: number | null
  onStop: () => void
  stopping: boolean
}

function formatElapsed(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000)
  if (sec < 60) return `${sec}s ago`
  return `${Math.floor(sec / 60)}m ${sec % 60}s ago`
}

export function FaultStatusIndicator({
  activeFaults,
  injectedAt,
  onStop,
  stopping,
}: FaultStatusIndicatorProps) {
  if (activeFaults.length === 0) return null

  const faultLabel = activeFaults.map(formatFaultName).join(', ')

  return (
    <div
      data-testid="fault-status-indicator"
      className="flex items-center justify-between rounded border border-red-800 bg-red-950/40 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm text-red-300">Fault active: {faultLabel}</span>
        {injectedAt != null && (
          <span className="text-xs text-red-500">{formatElapsed(injectedAt)}</span>
        )}
      </div>
      <button
        data-testid="stop-fault-button"
        onClick={onStop}
        disabled={stopping}
        className="text-xs bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white rounded px-2 py-1 transition-colors"
      >
        {stopping ? '…' : 'Stop Fault ■'}
      </button>
    </div>
  )
}
