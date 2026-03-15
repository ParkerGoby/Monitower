'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { StateSnapshot, Incident } from '@/types/monitower'

const defaultState: StateSnapshot = {
  ts: 0,
  services: [],
  queues: [],
  incidents: [],
  baselineReady: false,
}

export function useMonitowerState() {
  const [state, setState] = useState<StateSnapshot>(defaultState)
  const connectedAtRef = useRef<number>(0)
  const [uptimeSeconds, setUptimeSeconds] = useState(0)

  useEffect(() => {
    connectedAtRef.current = Date.now()
    const es = new EventSource('/api/events/stream')
    es.addEventListener('state', (e) => {
      setState(JSON.parse(e.data))
    })
    es.addEventListener('incident', (e) => {
      const updated: Incident[] = JSON.parse(e.data)
      setState((prev) => ({ ...prev, incidents: updated }))
    })
    return () => es.close()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const activeFaults = useMemo(() => {
    const faults = new Set<string>()
    state.services.forEach((s) => s.activeFaults.forEach((f) => faults.add(f)))
    return Array.from(faults)
  }, [state.services])

  return { state, activeFaults, uptimeSeconds }
}
