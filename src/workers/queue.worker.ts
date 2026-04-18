import { Worker } from 'bullmq';

import { config, redactedConfig } from '@/config';
import { logger } from '@/core/logger';
import { getRedisConnection, closeRedisConnection } from '@/core/queue/redis.connection';
import { closeDbPool } from '@/database/client';
import { jobService } from '@/services';
import type { QueueJobPayload } from '@/types/job';
import { processorRegistry } from '@/services/processor-registry';
import { queueNames } from '@/core/queue/queue.factory';

const startedAtByJob = new Map<string, number>();

const worker = new Worker<QueueJobPayload>(
  queueNames.main,
  async (job) => {
    const attempt = job.attemptsMade + 1;
    return processorRegistry.execute(job.data.type, job.data.payload, {
      jobId: job.data.jobId,
      attempt,
    });
  },
  {
    connection: getRedisConnection(),
    concurrency: config.worker.concurrency,
    lockDuration: config.worker.lockDuration,
  }
);

worker.on('active', (job) => {
  const jobId = job.id ?? job.data.jobId;
  startedAtByJob.set(jobId, Date.now());
  void jobService.onJobActive(job.data.jobId, job.attemptsMade + 1).catch((error) => {
    logger.error({ error, jobId: job.data.jobId }, 'Failed to persist active event');
  });
});

worker.on('completed', (job, result) => {
  const jobId = job.id ?? job.data.jobId;
  const startedAt = startedAtByJob.get(jobId) ?? Date.now();
  const durationMs = Date.now() - startedAt;
  startedAtByJob.delete(jobId);

  const resultPayload =
    typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : { value: result };

  void jobService
    .onJobCompleted(job.data.jobId, job.data.type, resultPayload, durationMs)
    .catch((error) => {
      logger.error({ error, jobId: job.data.jobId }, 'Failed to persist completion event');
    });
});

worker.on('failed', (job, error) => {
  if (!job) {
    logger.error({ error }, 'Worker emitted failed event without job');
    return;
  }

  const jobId = job.id ?? job.data.jobId;
  const startedAt = startedAtByJob.get(jobId) ?? Date.now();
  const durationMs = Date.now() - startedAt;
  startedAtByJob.delete(jobId);

  const maxAttempts = job.opts.attempts ?? 1;
  const attempts = job.attemptsMade;

  void jobService
    .onJobFailed(job.data.jobId, job.data.type, attempts, maxAttempts, error, durationMs)
    .catch((persistError) => {
      logger.error(
        {
          error: persistError,
          originalError: error,
          jobId: job.data.jobId,
        },
        'Failed to persist failed event'
      );
    });
});

worker.on('stalled', (jobId) => {
  if (!jobId) {
    return;
  }
  void jobService.onJobStalled(jobId).catch((error) => {
    logger.error({ error, jobId }, 'Failed to persist stalled event');
  });
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Worker shutdown signal received');

  try {
    await worker.close();
    await Promise.all([closeRedisConnection(), closeDbPool()]);
    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Failed during worker shutdown');
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

logger.info(
  {
    queue: queueNames.main,
    concurrency: config.worker.concurrency,
    env: config.nodeEnv,
    config: redactedConfig,
  },
  'Worker started'
);
