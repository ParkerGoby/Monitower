export const dynamic = 'force-dynamic'

const MONITOR_URL = process.env.MONITOR_URL ?? 'http://localhost:3001'

export async function GET() {
  const res = await fetch(`${MONITOR_URL}/api/state`)
  const data = await res.json()
  return Response.json(data)
}
