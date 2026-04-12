CREATE TABLE IF NOT EXISTS outbox_events (
  id BIGSERIAL PRIMARY KEY,

  aggregate_id UUID NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending', -- pending | processed | failed
  attempts INT NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Index for fast polling
CREATE INDEX idx_outbox_status_created_at
ON outbox_events (status, created_at);