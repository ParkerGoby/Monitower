export const dynamic = 'force-dynamic'

const MONITOR_URL = process.env.MONITOR_URL ?? 'http://localhost:3001'

export async function GET() {
  const upstream = await fetch(`${MONITOR_URL}/api/events/stream`, {
    headers: { Accept: 'text/event-stream' },
  })

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
