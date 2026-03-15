import { test, expect, Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal MonitowerState snapshot matching the backend's actual JSON shape */
const healthyState = {
  ts: Date.now(),
  baselineReady: true,
  services: [
    {
      name: 'order-service',
      throughput: 10.0,
      errorRate: 0.01,
      p50Latency: 120,
      p99Latency: 300,
      status: 'healthy',
      activeFaults: [],
    },
    {
      name: 'payment-service',
      throughput: 9.5,
      errorRate: 0.01,
      p50Latency: 130,
      p99Latency: 320,
      status: 'healthy',
      activeFaults: [],
    },
    {
      name: 'fulfillment-service',
      throughput: 9.0,
      errorRate: 0.01,
      p50Latency: 110,
      p99Latency: 290,
      status: 'healthy',
      activeFaults: [],
    },
    {
      name: 'notification-service',
      throughput: 8.5,
      errorRate: 0.01,
      p50Latency: 105,
      p99Latency: 280,
      status: 'healthy',
      activeFaults: [],
    },
  ],
  queues: [
    { name: 'order-queue', depth: 5, enqueueRate: 4.2, dequeueRate: 4.1, isDlq: false },
    { name: 'payment-queue', depth: 3, enqueueRate: 3.8, dequeueRate: 3.7, isDlq: false },
    { name: 'payment-dlq', depth: 0, enqueueRate: 0, dequeueRate: 0, isDlq: true },
    { name: 'notification-dlq', depth: 0, enqueueRate: 0, dequeueRate: 0, isDlq: true },
  ],
  incidents: [],
}

type StateShape = typeof healthyState

/**
 * Intercepts the SSE stream route and emits a single `state` event then
 * holds the connection open. Also intercepts /api/incidents and /api/state.
 */
async function mockSSE(page: Page, state: StateShape = healthyState) {
  const body = `event: state\ndata: ${JSON.stringify(state)}\n\n`

  await page.route('**/api/events/stream', (route) => {
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body,
    })
  })

  await page.route('**/api/state', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) })
  })

  await page.route('**/api/incidents', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.incidents ?? []),
    })
  })
}

// ---------------------------------------------------------------------------
// Test 1: Page structure on initial load
// ---------------------------------------------------------------------------

test('renders page structure with all service cards and panels', async ({ page }) => {
  await mockSSE(page)
  await page.goto('/')

  await expect(page).toHaveTitle(/Monitower/)

  // SystemStatusBar
  await expect(page.getByTestId('system-status-bar')).toBeVisible()

  // 4 service cards
  const cards = page.getByTestId('service-card')
  await expect(cards).toHaveCount(4)

  // IncidentPanel
  await expect(page.getByTestId('incident-panel')).toBeVisible()

  // FaultInjector
  await expect(page.getByTestId('fault-injector')).toBeVisible()
})

// ---------------------------------------------------------------------------
// Test 2: Service card renders correct metrics from SSE state
// ---------------------------------------------------------------------------

test('service card displays metrics from SSE state event', async ({ page }) => {
  const state = {
    ...healthyState,
    services: healthyState.services.map((s) =>
      s.name === 'order-service' ? { ...s, throughput: 42.5, errorRate: 0.03 } : s
    ),
  }

  await mockSSE(page, state)
  await page.goto('/')

  const orderCard = page.getByTestId('service-card-order-service')
  await expect(orderCard).toBeVisible()
  await expect(orderCard).toContainText('42.5')
})

// ---------------------------------------------------------------------------
// Test 3: Status dot color logic
// ---------------------------------------------------------------------------

test('status dot is red when errorRate > 0.20', async ({ page }) => {
  const state = {
    ...healthyState,
    services: healthyState.services.map((s) =>
      s.name === 'payment-service' ? { ...s, errorRate: 0.25 } : s
    ),
  }

  await mockSSE(page, state)
  await page.goto('/')

  const dot = page.getByTestId('status-dot-payment-service')
  await expect(dot).toHaveAttribute('data-status', 'red')
})

test('status dot is green when service is healthy', async ({ page }) => {
  await mockSSE(page)
  await page.goto('/')

  const dot = page.getByTestId('status-dot-order-service')
  await expect(dot).toHaveAttribute('data-status', 'green')
})

// ---------------------------------------------------------------------------
// Test 4: DLQ badge visibility
// ---------------------------------------------------------------------------

test('DLQ badge shown on notification card when dlq depth > 0', async ({ page }) => {
  const state = {
    ...healthyState,
    queues: healthyState.queues.map((q) =>
      q.name === 'notification-dlq' ? { ...q, depth: 15 } : q
    ),
  }

  await mockSSE(page, state)
  await page.goto('/')

  const badge = page.getByTestId('dlq-badge-notification-service')
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('15')
})

test('DLQ badge hidden when notification dlq depth is 0', async ({ page }) => {
  await mockSSE(page)
  await page.goto('/')

  const badge = page.getByTestId('dlq-badge-notification-service')
  await expect(badge).not.toBeVisible()
})

test('DLQ badge not present on order-service card', async ({ page }) => {
  await mockSSE(page)
  await page.goto('/')

  await expect(page.getByTestId('dlq-badge-order-service')).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// Test 5: Fault injection flow
// ---------------------------------------------------------------------------

test('inject fault POSTs correct body and shows FaultStatusIndicator', async ({ page }) => {
  let capturedBody: string | null = null

  await mockSSE(page)

  await page.route('**/api/faults/inject', (route) => {
    capturedBody = route.request().postData()
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })

  await page.goto('/')

  await page.getByTestId('fault-selector').selectOption('poison-pill')
  await page.getByTestId('inject-button').click()

  expect(capturedBody).toBeTruthy()
  const parsed = JSON.parse(capturedBody!)
  expect(parsed.faultType).toBe('poison-pill')

  // Reload with SSE reflecting the active fault (activeFaults set on a service)
  const stateWithFault = {
    ...healthyState,
    services: healthyState.services.map((s) =>
      s.name === 'order-service' ? { ...s, activeFaults: ['poison-pill'] } : s
    ),
  }
  await page.route('**/api/events/stream', (route) => {
    const body = `event: state\ndata: ${JSON.stringify(stateWithFault)}\n\n`
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body,
    })
  })

  await page.reload()
  await expect(page.getByTestId('fault-status-indicator')).toBeVisible()
  await expect(page.getByTestId('fault-status-indicator')).toContainText('Poison Pill')
  await expect(page.getByTestId('stop-fault-button')).toBeVisible()
})

// ---------------------------------------------------------------------------
// Test 6: Stop fault flow
// ---------------------------------------------------------------------------

test('stop fault button calls POST /api/faults/stop', async ({ page }) => {
  let stopCalled = false

  const stateWithFault = {
    ...healthyState,
    services: healthyState.services.map((s) =>
      s.name === 'order-service' ? { ...s, activeFaults: ['poison-pill'] } : s
    ),
  }

  await page.route('**/api/events/stream', (route) => {
    const body = `event: state\ndata: ${JSON.stringify(stateWithFault)}\n\n`
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body,
    })
  })
  await page.route('**/api/state', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stateWithFault) })
  })
  await page.route('**/api/incidents', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.route('**/api/faults/stop', (route) => {
    stopCalled = true
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })

  await page.goto('/')

  await expect(page.getByTestId('stop-fault-button')).toBeVisible()
  await page.getByTestId('stop-fault-button').click()
  expect(stopCalled).toBe(true)
})

// ---------------------------------------------------------------------------
// Test 7: Active incident display + timeline
// ---------------------------------------------------------------------------

test('incident card shows root cause, affected services, and expandable timeline', async ({
  page,
}) => {
  const now = Date.now()
  const incident = {
    id: 1,
    startedAt: now - 3 * 60 * 1000,
    resolvedAt: null,
    severity: 'critical',
    rootCause: 'Payment service error rate spike',
    rootService: 'payment-service',
    affected: ['payment-service', 'fulfillment-service'],
    faultType: 'cascading-failure',
    timeline: [
      { ts: now - 3 * 60 * 1000, message: 'payment-service: Error Rate Spike — 84% error rate' },
      { ts: now - 2 * 60 * 1000, message: 'fulfillment-service: Throughput Drop — 2.1 msg/s' },
    ],
    status: 'active',
  }

  const state = { ...healthyState, incidents: [incident] }
  await mockSSE(page, state as StateShape)
  await page.goto('/')

  const card = page.getByTestId('incident-card-1')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Payment service error rate spike')
  await expect(card).toContainText('payment-service')
  await expect(card).toContainText('fulfillment-service')

  await card.getByTestId('view-timeline-button').click()
  const timeline = page.getByTestId('incident-timeline-1')
  await expect(timeline).toBeVisible()
  await expect(timeline).toContainText('Error Rate Spike')
  await expect(timeline).toContainText('Throughput Drop')
})

// ---------------------------------------------------------------------------
// Test 8: Recent incidents list
// ---------------------------------------------------------------------------

test('resolved incidents appear in Recent Incidents section', async ({ page }) => {
  const now = Date.now()
  const resolved = [
    {
      id: 2,
      startedAt: now - 10 * 60 * 1000,
      resolvedAt: now - 8 * 60 * 1000,
      severity: 'warning',
      rootCause: 'Intermittent errors in notification service',
      rootService: 'notification-service',
      affected: ['notification-service'],
      faultType: 'intermittent-errors',
      timeline: [],
      status: 'resolved',
    },
    {
      id: 3,
      startedAt: now - 20 * 60 * 1000,
      resolvedAt: now - 18 * 60 * 1000,
      severity: 'critical',
      rootCause: 'Traffic spike caused queue overflow',
      rootService: 'order-service',
      affected: ['order-service', 'payment-service'],
      faultType: 'traffic-spike',
      timeline: [],
      status: 'resolved',
    },
  ]

  const state = { ...healthyState, incidents: resolved }
  await mockSSE(page, state as StateShape)
  await page.goto('/')

  const recentSection = page.getByTestId('recent-incidents')
  await expect(recentSection).toBeVisible()
  await expect(recentSection).toContainText('Intermittent errors in notification service')
  await expect(recentSection).toContainText('Traffic spike caused queue overflow')
})

// ---------------------------------------------------------------------------
// Test 9: Responsive layout
// ---------------------------------------------------------------------------

test('service grid collapses to single column on mobile viewport', async ({ page }) => {
  await mockSSE(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  const grid = page.getByTestId('service-grid')
  await expect(grid).toBeVisible()
  await expect(grid).toHaveClass(/grid-cols-1/)
})

// ---------------------------------------------------------------------------
// Test 10: SystemStatusBar severity changes
// ---------------------------------------------------------------------------

test('status bar shows healthy state by default', async ({ page }) => {
  await mockSSE(page)
  await page.goto('/')

  const bar = page.getByTestId('system-status-bar')
  await expect(bar).toContainText('All systems healthy')
  await expect(bar).toHaveAttribute('data-severity', 'healthy')
})

test('status bar reflects critical incident', async ({ page }) => {
  const now = Date.now()
  const incident = {
    id: 4,
    startedAt: now,
    resolvedAt: null,
    severity: 'critical',
    rootCause: 'Cascading failure in payment',
    rootService: 'payment-service',
    affected: ['payment-service'],
    faultType: 'cascading-failure',
    timeline: [],
    status: 'active',
  }

  const state = { ...healthyState, incidents: [incident] }
  await mockSSE(page, state as StateShape)
  await page.goto('/')

  const bar = page.getByTestId('system-status-bar')
  await expect(bar).toHaveAttribute('data-severity', 'critical')
  await expect(bar).toContainText('1 active incident')
})
