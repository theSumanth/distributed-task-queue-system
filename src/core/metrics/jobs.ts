import { Counter, Histogram } from 'prom-client';

import { elapsedSecondsSince, isMetricsEnabled, metricsRegistry } from './registry';

type JobOutcome = 'success' | 'retry' | 'terminal';

const jobsCreatedTotal = new Counter({
  name: 'task_queue_jobs_created_total',
  help: 'Total jobs created by type and priority.',
  labelNames: ['type', 'priority'] as const,
  registers: [metricsRegistry],
});

const jobsCancelledTotal = new Counter({
  name: 'task_queue_jobs_cancelled_total',
  help: 'Total jobs cancelled by type and outcome.',
  labelNames: ['type', 'outcome'] as const,
  registers: [metricsRegistry],
});

const jobStateTransitionsTotal = new Counter({
  name: 'task_queue_job_state_transitions_total',
  help: 'Total persisted job state transitions.',
  labelNames: ['type', 'status'] as const,
  registers: [metricsRegistry],
});

const jobExecutionDurationSeconds = new Histogram({
  name: 'task_queue_job_execution_duration_seconds',
  help: 'Persisted job execution duration in seconds by final outcome.',
  labelNames: ['type', 'outcome'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const recordJobCreated = (type: string, priority: string): void => {
  if (!isMetricsEnabled()) return;
  jobsCreatedTotal.inc({ type, priority });
};

export const recordJobCancelled = (type: string, outcome: 'success' | 'conflict'): void => {
  if (!isMetricsEnabled()) return;
  jobsCancelledTotal.inc({ type, outcome });
};

export const recordJobStateTransition = (type: string, status: string): void => {
  if (!isMetricsEnabled()) return;
  jobStateTransitionsTotal.inc({ type, status });
};

export const recordJobExecutionDuration = (
  type: string,
  outcome: JobOutcome,
  durationMs: number
): void => {
  if (!isMetricsEnabled()) return;
  jobExecutionDurationSeconds.observe({ type, outcome }, durationMs / 1000);
};

export const startJobTimer = (): ((type: string, outcome: JobOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (type: string, outcome: JobOutcome): void => {
    if (!isMetricsEnabled()) return;
    jobExecutionDurationSeconds.observe({ type, outcome }, elapsedSecondsSince(startedAt));
  };
};
