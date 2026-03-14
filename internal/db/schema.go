package db

import "database/sql"

const schema = `
CREATE TABLE IF NOT EXISTS service_metrics (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  service       TEXT    NOT NULL,
  throughput    REAL    NOT NULL,
  error_rate    REAL    NOT NULL,
  p50_latency   REAL    NOT NULL,
  p99_latency   REAL    NOT NULL,
  active_faults TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_service_metrics_ts      ON service_metrics (ts);
CREATE INDEX IF NOT EXISTS idx_service_metrics_service ON service_metrics (service, ts);

CREATE TABLE IF NOT EXISTS queue_metrics (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  queue        TEXT    NOT NULL,
  depth        INTEGER NOT NULL,
  enqueue_rate REAL    NOT NULL,
  dequeue_rate REAL    NOT NULL,
  dlq          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_ts    ON queue_metrics (ts);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_queue ON queue_metrics (queue, ts);

CREATE TABLE IF NOT EXISTS incidents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at   INTEGER NOT NULL,
  resolved_at  INTEGER,
  severity     TEXT    NOT NULL,
  root_cause   TEXT    NOT NULL,
  root_service TEXT    NOT NULL,
  affected     TEXT    NOT NULL,
  fault_type   TEXT,
  timeline     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents (started_at);
CREATE INDEX IF NOT EXISTS idx_incidents_status     ON incidents (status);

CREATE TABLE IF NOT EXISTS fault_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         INTEGER NOT NULL,
  fault_type TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  origin     TEXT    NOT NULL
);
`

func migrate(db *sql.DB) error {
	_, err := db.Exec(schema)
	return err
}
