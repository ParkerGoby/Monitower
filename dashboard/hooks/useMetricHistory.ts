'use client'

import { useState, useEffect } from 'react'

export interface HistoryPoint {
  ts: number
  value: number
}

export function useMetricHistory(service: string, metric: string = 'error_rate') {
  const [history, setHistory] = useState<HistoryPoint[]>([])

  useEffect(() => {
    if (!service) return
    fetch(`/api/metrics/history?service=${encodeURIComponent(service)}&metric=${encodeURIComponent(metric)}&window=60`)
      .then((r) => r.json())
      .then((data: HistoryPoint[]) => setHistory(data))
      .catch(() => {})
  }, [service, metric])

  return history
}
