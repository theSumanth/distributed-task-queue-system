import { collectDefaultMetrics, Registry } from 'prom-client';

import { config } from '@/config';

export type MetricsRole = 'app' | 'queue-worker' | 'outbox-worker';

export const metricsRegistry = new Registry();

let initializedRole: MetricsRole | null = null;

export const isMetricsEnabled = (): boolean => config.metrics.enabled;

export const initializeMetrics = (role: MetricsRole): void => {
  if (initializedRole) {
    if (initializedRole !== role) {
      throw new Error(`Metrics already initialized with role=${initializedRole}`);
    }
    return;
  }

  metricsRegistry.setDefaultLabels({
    service: 'distributed-task-queue-system',
    env: config.nodeEnv,
    role,
  });

  if (isMetricsEnabled()) {
    collectDefaultMetrics({
      register: metricsRegistry,
      prefix: 'task_queue_',
    });
  }

  initializedRole = role;
};

export const elapsedSecondsSince = (startedAt: bigint): number => {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
};
