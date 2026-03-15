package simulator

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	mrand "math/rand"
	"sync"
	"time"
)

// FulfillmentService consumes approved and declined payment messages from
// payment-queue and simulates warehouse pick/ship/confirm steps. It is the
// terminal node in the order pipeline and produces no downstream queue output.
//
// Its primary observable failure mode is starvation: when payment-queue drains
// because an upstream service has stopped producing, throughput falls to zero
// while error_rate stays at zero.
type FulfillmentService struct {
	paymentQueue *Queue
	engine       *FaultEngine
	db           *sql.DB
	ctx          context.Context

	mu          sync.Mutex
	processed   int
	errors      int
	totalMsgs   int
	latencies   []float64
	lastFlushAt time.Time
}

// NewFulfillmentService creates a FulfillmentService and starts its background goroutines.
func NewFulfillmentService(paymentQueue *Queue, engine *FaultEngine, db *sql.DB, ctx context.Context) *FulfillmentService {
	s := &FulfillmentService{
		paymentQueue: paymentQueue,
		engine:       engine,
		db:           db,
		ctx:          ctx,
		lastFlushAt:  time.Now(),
	}
	go s.runTicker()
	go s.runMetricsWriter()
	return s
}

// ForceWriteMetrics immediately flushes accumulated counters to service_metrics
// using the actual elapsed time since the last flush. Intended for tests.
func (s *FulfillmentService) ForceWriteMetrics() {
	now := time.Now()
	s.mu.Lock()
	elapsed := now.Sub(s.lastFlushAt)
	s.mu.Unlock()
	if elapsed < time.Millisecond {
		elapsed = time.Millisecond
	}
	s.writeMetrics(elapsed)
}

// runTicker fires a processing tick every 150ms.
func (s *FulfillmentService) runTicker() {
	ticker := time.NewTicker(150 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.processTick()
		case <-s.ctx.Done():
			return
		}
	}
}

// processTick polls up to 3 messages from payment-queue and spawns a goroutine
// per message. When the queue is empty, this is a no-op — the natural starvation
// pattern requires no special handling.
func (s *FulfillmentService) processTick() {
	for i := 0; i < 3; i++ {
		msg, ok := s.paymentQueue.TryReceive()
		if !ok {
			break
		}
		go s.processMessage(msg)
	}
}

// processMessage simulates fulfillment steps for a single payment message.
// Declined payments are counted as processed (not errors). Failed attempts are
// retried up to 3 times; exhausted retries are discarded (no DLQ).
func (s *FulfillmentService) processMessage(raw string) {
	var msg paymentMessage
	if err := json.Unmarshal([]byte(raw), &msg); err != nil {
		s.mu.Lock()
		s.errors++
		s.totalMsgs++
		s.mu.Unlock()
		return
	}

	// Declined payments: log decline, count as processed, no error.
	if msg.Status == "declined" {
		s.mu.Lock()
		s.processed++
		s.totalMsgs++
		s.mu.Unlock()
		return
	}

	const maxAttempts = 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		start := time.Now()

		sleepDur := time.Duration(30+mrand.Intn(51)) * time.Millisecond
		select {
		case <-time.After(sleepDur):
		case <-s.ctx.Done():
			return
		}

		latencyMs := float64(time.Since(start).Milliseconds())

		fctx := s.engine.GetFaultContext("fulfillment")
		failed := fctx.ErrorProbability > 0 && mrand.Float64() < fctx.ErrorProbability

		if !failed {
			s.mu.Lock()
			s.processed++
			s.totalMsgs++
			s.latencies = append(s.latencies, latencyMs)
			s.mu.Unlock()
			return
		}

		s.mu.Lock()
		s.errors++
		s.totalMsgs++
		s.mu.Unlock()

		if attempt < maxAttempts {
			select {
			case <-time.After(200 * time.Millisecond):
			case <-s.ctx.Done():
				return
			}
			continue
		}

		// All retries exhausted: discard the message.
		log.Printf("fulfillment: discarded message %s after %d attempts", msg.MessageID, maxAttempts)
	}
}

// runMetricsWriter writes a service_metrics row every 2–3s (jittered).
func (s *FulfillmentService) runMetricsWriter() {
	for {
		delay := time.Duration(2000+mrand.Intn(1000)) * time.Millisecond
		select {
		case <-time.After(delay):
			s.writeMetrics(delay)
		case <-s.ctx.Done():
			return
		}
	}
}

func (s *FulfillmentService) writeMetrics(elapsed time.Duration) {
	s.mu.Lock()
	processed := s.processed
	errors := s.errors
	totalMsgs := s.totalMsgs
	latencies := s.latencies
	s.processed = 0
	s.errors = 0
	s.totalMsgs = 0
	s.latencies = nil
	s.lastFlushAt = time.Now()
	s.mu.Unlock()

	elapsedSec := elapsed.Seconds()
	throughput := float64(processed) / elapsedSec

	var errorRate float64
	if totalMsgs > 0 {
		errorRate = float64(errors) / float64(totalMsgs)
	}

	p50, p99 := percentiles(latencies)
	activeFaults := activeFaultNames(s.engine)

	ts := time.Now().UnixMilli()
	_, _ = s.db.Exec(
		`INSERT INTO service_metrics (ts, service, throughput, error_rate, p50_latency, p99_latency, active_faults)
		 VALUES (?, 'fulfillment', ?, ?, ?, ?, ?)`,
		ts, throughput, errorRate, p50, p99, activeFaults,
	)
}
