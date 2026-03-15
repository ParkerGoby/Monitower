export const dynamic = 'force-dynamic'

const MONITOR_URL = process.env.MONITOR_URL ?? 'http://localhost:3001'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = searchParams.get('limit') ?? '20'
  const offset = searchParams.get('offset') ?? '0'
  const res = await fetch(`${MONITOR_URL}/api/incidents?limit=${limit}&offset=${offset}`)
  const data = await res.json()
  return Response.json(data)
}
