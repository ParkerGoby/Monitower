package simulator_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/parkerg/monitower/internal/simulator"
)

// makePaymentMsg builds a JSON paymentMessage string suitable for pre-loading
// payment-queue in fulfillment service tests.
func makePaymentMsg(status string) string {
	pm := paymentMsg{
		MessageID:     "test-msg-id",
		OrderID:       "test-order-id",
		CustomerID:    "test-customer-id",
		TotalAmount:   19.99,
		Status:        status,
		TransactionID: "test-txn-id",
		ProcessedAt:   time.Now().UnixMilli(),
		TraceID:       "test-trace-id",
		ProcessingMs:  75,
	}
	b, _ := json.Marshal(pm)
	return string(b)
}

// ── Service Metrics ───────────────────────────────────────────────────────────

// 1. ForceWriteMetrics writes a service_metrics row immediately, even with zero activity.
func TestFulfillmentService_WritesServiceMetrics(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)
	pq := simulator.NewQueue("payment-queue", false, db, ctx)
	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	svc.ForceWriteMetrics()

	var count int
	db.QueryRow(`SELECT COUNT(*) FROM service_metrics WHERE service='fulfillment'`).Scan(&count)
	if count == 0 {
		t.Error("expected at least one service_metrics row after ForceWriteMetrics")
	}
}

// 2. After context cancel, no further metrics rows are written.
func TestFulfillmentService_Stop_NoFurtherWrites(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())

	engine := simulator.NewFaultEngine(db)
	pq := simulator.NewQueue("payment-queue", false, db, ctx)
	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	svc.ForceWriteMetrics()
	cancel()
	time.Sleep(100 * time.Millisecond) // let goroutines exit

	var countBefore int
	db.QueryRow(`SELECT COUNT(*) FROM service_metrics WHERE service='fulfillment'`).Scan(&countBefore)

	time.Sleep(100 * time.Millisecond)

	var countAfter int
	db.QueryRow(`SELECT COUNT(*) FROM service_metrics WHERE service='fulfillment'`).Scan(&countAfter)
	if countAfter != countBefore {
		t.Errorf("expected no new rows after stop, got %d new rows", countAfter-countBefore)
	}
}

// ── Happy Path ────────────────────────────────────────────────────────────────

// 3. Approved messages are consumed; throughput > 0, error_rate = 0.
func TestFulfillmentService_ApprovedMessages_Throughput(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)
	pq := simulator.NewQueue("payment-queue", false, db, ctx)

	// Pre-load payment-queue with approved messages.
	for i := 0; i < 20; i++ {
		pq.Send(makePaymentMsg("approved"))
	}

	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	// Wait for ticks to process messages (150ms tick + up to 80ms per message).
	time.Sleep(1 * time.Second)
	svc.ForceWriteMetrics()

	var throughput, errorRate float64
	err := db.QueryRow(
		`SELECT throughput, error_rate FROM service_metrics WHERE service='fulfillment' ORDER BY ts DESC LIMIT 1`,
	).Scan(&throughput, &errorRate)
	if err != nil {
		t.Fatalf("no metrics row found: %v", err)
	}
	if throughput <= 0 {
		t.Errorf("expected throughput > 0 for approved messages, got %.4f", throughput)
	}
	if errorRate != 0 {
		t.Errorf("expected error_rate = 0 for approved messages with no faults, got %.4f", errorRate)
	}
}

// 4. Declined messages count toward throughput but not errors.
func TestFulfillmentService_DeclinedMessages_CountAsThroughput(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)
	pq := simulator.NewQueue("payment-queue", false, db, ctx)

	for i := 0; i < 10; i++ {
		pq.Send(makePaymentMsg("declined"))
	}

	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	time.Sleep(500 * time.Millisecond)
	svc.ForceWriteMetrics()

	var throughput, errorRate float64
	err := db.QueryRow(
		`SELECT throughput, error_rate FROM service_metrics WHERE service='fulfillment' ORDER BY ts DESC LIMIT 1`,
	).Scan(&throughput, &errorRate)
	if err != nil {
		t.Fatalf("no metrics row found: %v", err)
	}
	if throughput <= 0 {
		t.Errorf("expected throughput > 0 for declined messages (processed, not errors), got %.4f", throughput)
	}
	if errorRate != 0 {
		t.Errorf("expected error_rate = 0 for declined messages, got %.4f", errorRate)
	}
}

// ── Starvation ────────────────────────────────────────────────────────────────

// 5. Empty queue produces throughput=0, error_rate=0.
func TestFulfillmentService_Starvation_ZeroThroughput(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)
	pq := simulator.NewQueue("payment-queue", false, db, ctx)
	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	time.Sleep(300 * time.Millisecond) // let ticks fire on empty queue
	svc.ForceWriteMetrics()

	var throughput, errorRate float64
	err := db.QueryRow(
		`SELECT throughput, error_rate FROM service_metrics WHERE service='fulfillment' ORDER BY ts DESC LIMIT 1`,
	).Scan(&throughput, &errorRate)
	if err != nil {
		t.Fatalf("no metrics row found: %v", err)
	}
	if throughput != 0 {
		t.Errorf("expected throughput=0 with empty queue (starvation), got %.4f", throughput)
	}
	if errorRate != 0 {
		t.Errorf("expected error_rate=0 with empty queue (starvation), got %.4f", errorRate)
	}
}

// ── Fault Behavior ────────────────────────────────────────────────────────────

// 6. Intermittent errors fault: service still writes valid metrics; error_rate and
// throughput are in [0,1] and [0,∞). Exact values are not asserted (probabilistic).
func TestFulfillmentService_IntermittentErrors_ServiceStillFunctions(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)
	engine.Activate(simulator.FaultIntermittentErrors, "all")

	pq := simulator.NewQueue("payment-queue", false, db, ctx)
	for i := 0; i < 30; i++ {
		pq.Send(makePaymentMsg("approved"))
	}

	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	time.Sleep(1 * time.Second)
	svc.ForceWriteMetrics()

	var throughput, errorRate float64
	err := db.QueryRow(
		`SELECT throughput, error_rate FROM service_metrics WHERE service='fulfillment' ORDER BY ts DESC LIMIT 1`,
	).Scan(&throughput, &errorRate)
	if err != nil {
		t.Fatalf("no metrics row found: %v", err)
	}
	if throughput < 0 {
		t.Errorf("throughput must be non-negative, got %.4f", throughput)
	}
	if errorRate < 0 || errorRate > 1 {
		t.Errorf("error_rate must be in [0,1], got %.4f", errorRate)
	}
}

// 7. active_faults column reflects active faults at write time.
func TestFulfillmentService_ActiveFaultsInMetrics(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)
	engine.Activate(simulator.FaultIntermittentErrors, "all")

	pq := simulator.NewQueue("payment-queue", false, db, ctx)
	svc := simulator.NewFulfillmentService(pq, engine, db, ctx)

	svc.ForceWriteMetrics()

	var activeFaults string
	db.QueryRow(
		`SELECT active_faults FROM service_metrics WHERE service='fulfillment' ORDER BY ts DESC LIMIT 1`,
	).Scan(&activeFaults)
	if !containsStr(activeFaults, "intermittent-errors") {
		t.Errorf("expected active_faults to contain 'intermittent-errors', got %q", activeFaults)
	}
}
