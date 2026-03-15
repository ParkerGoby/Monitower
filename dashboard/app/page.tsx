'use client'

import { useMonitowerState } from '@/hooks/useMonitowerState'
import { SystemStatusBar } from '@/components/dashboard/SystemStatusBar'
import { ServiceGrid } from '@/components/dashboard/ServiceGrid'
import { IncidentPanel } from '@/components/dashboard/IncidentPanel'
import { FaultInjector } from '@/components/dashboard/FaultInjector'

export default function DashboardPage() {
  const { state, activeFaults, uptimeSeconds } = useMonitowerState()

  return (
    <div className="min-h-screen flex flex-col">
      <SystemStatusBar
        incidents={state.incidents}
        activeFaults={activeFaults}
        uptime={uptimeSeconds}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <ServiceGrid services={state.services} queues={state.queues} />

        <div className="flex flex-col gap-4">
          <IncidentPanel incidents={state.incidents} />
          <FaultInjector activeFaults={activeFaults} />
        </div>
      </div>
    </div>
  )
}
