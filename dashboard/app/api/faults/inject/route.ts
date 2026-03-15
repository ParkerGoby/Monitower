const SIMULATOR_URL = process.env.SIMULATOR_URL ?? 'http://localhost:3002'

export async function POST(req: Request) {
  const body = await req.json()
  const res = await fetch(`${SIMULATOR_URL}/api/faults/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}
