'use client'

import { useState } from 'react'
import { FaultStatusIndicator } from './FaultStatusIndicator'

interface FaultInjectorProps {
  activeFaults: string[]
}

const FAULT_OPTIONS = [
  { value: 'poison-pill', label: 'Poison Pill — malformed payload from Order' },
  { value: 'downstream-timeout', label: 'Downstream Timeout — Payment hangs' },
  { value: 'traffic-spike', label: 'Traffic Spike — 10x request rate' },
  { value: 'cascading-failure', label: 'Cascading Failure — Payment crashes' },
  { value: 'intermittent-errors', label: 'Intermittent Errors — ~15% random failures' },
]

export function FaultInjector({ activeFaults }: FaultInjectorProps) {
  const [selected, setSelected] = useState(FAULT_OPTIONS[0].value)
  const [injecting, setInjecting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [injectedAt, setInjectedAt] = useState<number | null>(null)

  const hasFault = activeFaults.length > 0

  async function handleInject() {
    setInjecting(true)
    try {
      await fetch('/api/faults/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faultType: selected }),
      })
      setInjectedAt(Date.now())
    } finally {
      setInjecting(false)
    }
  }

  async function handleStop() {
    setStopping(true)
    try {
      await fetch('/api/faults/stop', { method: 'POST' })
      setInjectedAt(null)
    } finally {
      setStopping(false)
    }
  }

  return (
    <div data-testid="fault-injector" className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
        Inject Fault
      </h2>

      <div className="flex gap-2">
        <select
          data-testid="fault-selector"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={hasFault}
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-100 text-sm px-2 py-1.5 focus:outline-none focus:border-zinc-500 disabled:opacity-50"
        >
          {FAULT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          data-testid="inject-button"
          onClick={handleInject}
          disabled={hasFault || injecting}
          className="rounded border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-sm px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {injecting ? '…' : 'Inject ▶'}
        </button>
      </div>

      <FaultStatusIndicator
        activeFaults={activeFaults}
        injectedAt={injectedAt}
        onStop={handleStop}
        stopping={stopping}
      />
    </div>
  )
}
