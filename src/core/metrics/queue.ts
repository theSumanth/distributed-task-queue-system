import { Counter, Gauge, Histogram } from 'prom-client';

import { config } from '@/config';

import { elapsedSecondsSince, isMetricsEnabled, metricsRegistry } from './registry';

type QueueOperationOutcome = 'success' | 'error' | 'not_found';
type QueueDepthCollector = () => Promise<Record<string, number>>;

const queueOperationsTotal = new Counter({
  name: 'task_queue_queue_operations_total',
  help: 'Total BullMQ queue operations by queue, operation, and outcome.',
  labelNames: ['queue', 'operation', 'outcome'] as const,
  registers: [metricsRegistry],
});

const queueOperationDurationSeconds = new Histogram({
  name: 'task_queue_queue_operation_duration_seconds',
  help: 'BullMQ queue operation duration in seconds.',
  labelNames: ['queue', 'operation', 'outcome'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

const queueDepthCollectionErrorsTotal = new Counter({
  name: 'task_queue_queue_depth_collection_errors_total',
  help: 'Total failures while collecting BullMQ queue depth metrics.',
  labelNames: ['queue'] as const,
  registers: [metricsRegistry],
});

const queueDepthCollectors = new Map<string, QueueDepthCollector>();
const cachedQueueDepths = new Map<string, Record<string, number>>();

let lastQueueDepthRefreshAt = 0;

const withCollectionTimeout = async <T>(promise: Promise<T>): Promise<T> => {
  const timeoutMs = Math.min(config.metrics.collectIntervalMs, 5000);
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Queue depth collection timed out')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

new Gauge({
  name: 'task_queue_queue_depth',
  help: 'BullMQ job counts by queue and state.',
  labelNames: ['queue', 'state'] as const,
  registers: [metricsRegistry],
  async collect() {
    if (!isMetricsEnabled()) return;

    const now = Date.now();
    const shouldRefresh = now - lastQueueDepthRefreshAt >= config.metrics.collectIntervalMs;

    if (shouldRefresh) {
      lastQueueDepthRefreshAt = now;

      for (const [queue, collector] of queueDepthCollectors) {
        try {
          cachedQueueDepths.set(queue, await withCollectionTimeout(collector()));
        } catch {
          queueDepthCollectionErrorsTotal.inc({ queue });
        }
      }
    }

    for (const [queue, counts] of cachedQueueDepths) {
      for (const [state, value] of Object.entries(counts)) {
        this.labels({ queue, state }).set(value);
      }
    }
  },
});

export const registerQueueDepthCollector = (
  queue: string,
  collector: QueueDepthCollector
): void => {
  queueDepthCollectors.set(queue, collector);
};

export const unregisterQueueDepthCollector = (queue: string): void => {
  queueDepthCollectors.delete(queue);
  cachedQueueDepths.delete(queue);
};

export const recordQueueOperation = (
  queue: string,
  operation: string,
  outcome: QueueOperationOutcome,
  durationSeconds: number
): void => {
  if (!isMetricsEnabled()) return;

  const labels = { queue, operation, outcome };
  queueOperationsTotal.inc(labels);
  queueOperationDurationSeconds.observe(labels, durationSeconds);
};

export const startQueueOperationTimer = (
  queue: string,
  operation: string
): ((outcome: QueueOperationOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (outcome: QueueOperationOutcome): void => {
    recordQueueOperation(queue, operation, outcome, elapsedSecondsSince(startedAt));
  };
};
