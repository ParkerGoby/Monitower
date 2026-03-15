import { ServiceStatus, QueueStatus } from '@/types/monitower'
import { ServiceCard } from './ServiceCard'

interface ServiceGridProps {
  services: ServiceStatus[]
  queues: QueueStatus[]
}

const SERVICE_ORDER = [
  'order-service',
  'payment-service',
  'fulfillment-service',
  'notification-service',
]

export function ServiceGrid({ services, queues }: ServiceGridProps) {
  const sorted = [...services].sort((a, b) => {
    const ai = SERVICE_ORDER.indexOf(a.name)
    const bi = SERVICE_ORDER.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div
      data-testid="service-grid"
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {sorted.map((service) => (
        <div key={service.name} data-testid="service-card">
          <ServiceCard service={service} queues={queues} />
        </div>
      ))}
    </div>
  )
}
