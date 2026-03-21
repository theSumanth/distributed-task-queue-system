CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  queue_job_id TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('email', 'webhook', 'generic')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed', 'retrying', 'dead_letter', 'cancelled')),
  priority TEXT NOT NULL CHECK (priority IN ('high', 'normal', 'low')),
  payload JSONB NOT NULL,
  result JSONB,
  error JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  delay_ms INTEGER NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ,
  cron TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_run_at ON jobs(run_at);

CREATE TABLE IF NOT EXISTS job_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed', 'retrying', 'dead_letter', 'cancelled')),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_created_at ON job_events(created_at DESC);
