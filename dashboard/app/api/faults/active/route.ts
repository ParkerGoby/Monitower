export const dynamic = 'force-dynamic'

const SIMULATOR_URL = process.env.SIMULATOR_URL ?? 'http://localhost:3002'

export async function GET() {
  const res = await fetch(`${SIMULATOR_URL}/api/faults/active`)
  const data = await res.json()
  return Response.json(data)
}
