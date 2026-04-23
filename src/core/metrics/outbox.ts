import { Counter, Histogram } from 'prom-client';

import { elapsedSecondsSince, isMetricsEnabled, metricsRegistry } from './registry';

type OutboxPollOutcome = 'empty' | 'success' | 'error';
type OutboxEventOutcome =
  | 'processed'
  | 'failed'
  | 'max_attempts'
  | 'skipped_backoff'
  | 'unknown_type';

const knownOutboxTypes = new Set(['job.enqueue', 'job.dead_letter']);

const outboxPollsTotal = new Counter({
  name: 'task_queue_outbox_polls_total',
  help: 'Total outbox polling attempts by outcome.',
  labelNames: ['outcome'] as const,
  registers: [metricsRegistry],
});

const outboxPollDurationSeconds = new Histogram({
  name: 'task_queue_outbox_poll_duration_seconds',
  help: 'Outbox poll duration in seconds.',
  labelNames: ['outcome'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

const outboxBatchSize = new Histogram({
  name: 'task_queue_outbox_batch_size',
  help: 'Number of events fetched in each outbox poll.',
  buckets: [0, 1, 2, 5, 10, 25, 50, 100],
  registers: [metricsRegistry],
});

const outboxEventsTotal = new Counter({
  name: 'task_queue_outbox_events_total',
  help: 'Total outbox events handled by normalized type and outcome.',
  labelNames: ['type', 'outcome'] as const,
  registers: [metricsRegistry],
});

const outboxEventDurationSeconds = new Histogram({
  name: 'task_queue_outbox_event_duration_seconds',
  help: 'Outbox event processing duration in seconds.',
  labelNames: ['type', 'outcome'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

const normalizeOutboxType = (type: string): string => {
  return knownOutboxTypes.has(type) ? type : 'unknown';
};

export const recordOutboxBatchSize = (size: number): void => {
  if (!isMetricsEnabled()) return;
  outboxBatchSize.observe(size);
};

export const recordOutboxEvent = (
  type: string,
  outcome: OutboxEventOutcome,
  durationSeconds: number
): void => {
  if (!isMetricsEnabled()) return;

  const labels = { type: normalizeOutboxType(type), outcome };
  outboxEventsTotal.inc(labels);
  outboxEventDurationSeconds.observe(labels, durationSeconds);
};

export const startOutboxEventTimer = (type: string): ((outcome: OutboxEventOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (outcome: OutboxEventOutcome): void => {
    recordOutboxEvent(type, outcome, elapsedSecondsSince(startedAt));
  };
};

export const recordOutboxPoll = (outcome: OutboxPollOutcome, durationSeconds: number): void => {
  if (!isMetricsEnabled()) return;

  outboxPollsTotal.inc({ outcome });
  outboxPollDurationSeconds.observe({ outcome }, durationSeconds);
};

export const startOutboxPollTimer = (): ((outcome: OutboxPollOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (outcome: OutboxPollOutcome): void => {
    recordOutboxPoll(outcome, elapsedSecondsSince(startedAt));
  };
};
