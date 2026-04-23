import { Counter, Gauge, Histogram } from 'prom-client';

import { elapsedSecondsSince, isMetricsEnabled, metricsRegistry } from './registry';

type WorkerEvent = 'started' | 'completed' | 'failed' | 'stalled';
type WorkerOutcome = 'success' | 'error';

const workerJobsTotal = new Counter({
  name: 'task_queue_worker_jobs_total',
  help: 'Total queue worker job lifecycle events.',
  labelNames: ['type', 'event'] as const,
  registers: [metricsRegistry],
});

const workerActiveJobs = new Gauge({
  name: 'task_queue_worker_active_jobs',
  help: 'Currently active queue worker jobs by type.',
  labelNames: ['type'] as const,
  registers: [metricsRegistry],
});

const workerJobDurationSeconds = new Histogram({
  name: 'task_queue_worker_job_duration_seconds',
  help: 'Queue worker job processing duration in seconds.',
  labelNames: ['type', 'outcome'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

const safeDec = (type: string) => {
  try {
    workerActiveJobs.dec({ type });
  } catch {
    // ignore negative safety issue
  }
};

const recordWorkerEvent = (type: string, event: WorkerEvent): void => {
  if (!isMetricsEnabled()) return;
  workerJobsTotal.inc({ type, event });
};

export const recordWorkerJobStarted = (type: string): void => {
  if (!isMetricsEnabled()) return;
  recordWorkerEvent(type, 'started');
  workerActiveJobs.inc({ type });
};

export const recordWorkerJobCompleted = (type: string, durationMs: number): void => {
  if (!isMetricsEnabled()) return;
  recordWorkerEvent(type, 'completed');
  safeDec(type);
  workerJobDurationSeconds.observe({ type, outcome: 'success' }, durationMs / 1000);
};

export const recordWorkerJobFailed = (type: string, durationMs: number): void => {
  if (!isMetricsEnabled()) return;
  recordWorkerEvent(type, 'failed');
  safeDec(type);
  workerJobDurationSeconds.observe({ type, outcome: 'error' }, durationMs / 1000);
};

export const recordWorkerJobStalled = (): void => {
  if (!isMetricsEnabled()) return;
  recordWorkerEvent('unknown', 'stalled');
};

export const startWorkerJobTimer = (): ((type: string, outcome: WorkerOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (type: string, outcome: WorkerOutcome): void => {
    if (!isMetricsEnabled()) return;
    workerJobDurationSeconds.observe({ type, outcome }, elapsedSecondsSince(startedAt));
  };
};
