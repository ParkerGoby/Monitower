export const dynamic = 'force-dynamic'

const MONITOR_URL = process.env.MONITOR_URL ?? 'http://localhost:3001'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const service = searchParams.get('service') ?? ''
  const metric = searchParams.get('metric') ?? 'error_rate'
  const window = searchParams.get('window') ?? '60'
  const res = await fetch(
    `${MONITOR_URL}/api/metrics/history?service=${encodeURIComponent(service)}&metric=${encodeURIComponent(metric)}&window=${window}`
  )
  const data = await res.json()
  return Response.json(data)
}
