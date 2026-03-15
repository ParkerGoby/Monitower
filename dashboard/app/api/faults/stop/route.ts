const SIMULATOR_URL = process.env.SIMULATOR_URL ?? 'http://localhost:3002'

export async function POST() {
  const res = await fetch(`${SIMULATOR_URL}/api/faults/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}
