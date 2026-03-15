package simulator_test

import (
	"context"
	"testing"
	"time"

	"github.com/parkerg/monitower/internal/simulator"
)

// TestSimulator_AllServicesProduceMetrics wires up Order, Payment, and Fulfillment
// services against a shared in-memory DB and verifies that all three services
// write at least one service_metrics row within 5 seconds.
func TestSimulator_AllServicesProduceMetrics(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)

	orderQueue := simulator.NewQueue("order-queue", false, db, ctx)
	paymentQueue := simulator.NewQueue("payment-queue", false, db, ctx)
	paymentDLQ := simulator.NewQueue("payment-dlq", true, db, ctx)

	orderSvc := simulator.NewOrderService(orderQueue, engine, db, ctx)
	paymentSvc := simulator.NewPaymentService(orderQueue, paymentQueue, paymentDLQ, engine, db, ctx)
	fulfillmentSvc := simulator.NewFulfillmentService(paymentQueue, engine, db, ctx)

	// Let the pipeline run for a bit, then force flush all services.
	time.Sleep(1 * time.Second)
	orderSvc.ForceWriteMetrics()
	paymentSvc.ForceWriteMetrics()
	fulfillmentSvc.ForceWriteMetrics()

	services := []string{"order", "payment", "fulfillment"}
	for _, svc := range services {
		var count int
		db.QueryRow(`SELECT COUNT(*) FROM service_metrics WHERE service=?`, svc).Scan(&count)
		if count == 0 {
			t.Errorf("expected service_metrics rows for service=%q, got none", svc)
		}
	}
}

// TestSimulator_FulfillmentConsumesFromPaymentQueue verifies end-to-end message
// flow: Order produces to order-queue → Payment processes and produces to
// payment-queue → Fulfillment consumes from payment-queue, reducing its depth.
func TestSimulator_FulfillmentConsumesFromPaymentQueue(t *testing.T) {
	db := openTestDB(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	engine := simulator.NewFaultEngine(db)

	orderQueue := simulator.NewQueue("order-queue", false, db, ctx)
	paymentQueue := simulator.NewQueue("payment-queue", false, db, ctx)
	paymentDLQ := simulator.NewQueue("payment-dlq", true, db, ctx)

	simulator.NewOrderService(orderQueue, engine, db, ctx)
	simulator.NewPaymentService(orderQueue, paymentQueue, paymentDLQ, engine, db, ctx)
	simulator.NewFulfillmentService(paymentQueue, engine, db, ctx)

	// Observe payment-queue depth over a 3s window. With Fulfillment running,
	// depth should stay bounded (≤ 20) rather than accumulating unboundedly.
	time.Sleep(3 * time.Second)
	depth := paymentQueue.Depth()
	if depth > 20 {
		t.Errorf("payment-queue depth too high (%d): Fulfillment may not be consuming", depth)
	}
}
