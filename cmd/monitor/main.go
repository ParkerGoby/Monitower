// Command monitor reads metrics from the shared SQLite database, detects
// anomalies, runs the correlation engine, and serves an HTTP API on :3001.
package main

import (
	"log"
	"os"

	"github.com/parkerg/watchtower/internal/db"
)

func main() {
	dbPath := os.Getenv("WATCHTOWER_DB")
	if dbPath == "" {
		dbPath = "watchtower.db"
	}

	conn, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer conn.Close()

	log.Println("monitor ready — not yet implemented")
	select {} // block until interrupted
}
