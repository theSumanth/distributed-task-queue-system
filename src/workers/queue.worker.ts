import { Worker } from 'bullmq';

import { config, redactedConfig } from '@/config';
import { logger } from '@/core/logger';
import {
  closeMetricsServer,
  initializeMetrics,
  recordWorkerJobCompleted,
  recordWorkerJobFailed,
  recordWorkerJobStalled,
  recordWorkerJobStarted,
  startMetricsServer,
} from '@/core/metrics';
import { getRedisConnection, closeRedisConnection, pingRedis } from '@/core/queue/redis.connection';
import { closeDbPool } from '@/database/client';
import { jobService } from '@/services';
import type { QueueJobPayload } from '@/api/schemas/job.schema';
import { processorRegistry } from '@/services/processor-registry';
import { queueNames } from '@/core/queue/queue.factory';

const start = async (): Promise<void> => {
  initializeMetrics('queue-worker');

  const port = Number(process.env['PORT'] || 4000);
  startMetricsServer('queue-worker', port);

  await pingRedis();
  const metricsServer = startMetricsServer('queue-worker', config.metrics.queueWorkerPort);
  const startedAtByJob = new Map<string, number>();

  const worker = new Worker<QueueJobPayload>(
    queueNames.main,
    async (job) => {
      const attempt = job.attemptsMade + 1;

      logger.info(
        {
          jobId: job.data.jobId,
          type: job.data.type,
          attempt,
        },
        'Job execution started'
      );

      const result = await processorRegistry.execute(job.data.type, job.data.payload, {
        jobId: job.data.jobId,
        attempt,
      });

      logger.info(
        {
          jobId: job.data.jobId,
          type: job.data.type,
          attempt,
          result,
        },
        'Job execution finished'
      );

      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: config.worker.concurrency,
      lockDuration: config.worker.lockDuration,
    }
  );

  worker.on('active', (job) => {
    const jobId = job.id ?? job.data.jobId;

    logger.info(
      {
        jobId: job.data.jobId,
        type: job.data.type,
        attempt: job.attemptsMade + 1,
      },
      'Job moved to active'
    );

    startedAtByJob.set(jobId, Date.now());
    recordWorkerJobStarted(job.data.type);

    void jobService.onJobActive(job.data.jobId, job.attemptsMade + 1).catch((error) => {
      logger.error({ error, jobId: job.data.jobId }, 'Failed to persist active event');
    });
  });

  worker.on('completed', (job, result) => {
    const jobId = job.id ?? job.data.jobId;
    const startedAt = startedAtByJob.get(jobId) ?? Date.now();
    const durationMs = Date.now() - startedAt;
    startedAtByJob.delete(jobId);
    recordWorkerJobCompleted(job.data.type, durationMs);

    logger.info(
      {
        jobId: job.data.jobId,
        type: job.data.type,
        durationMs,
        result,
      },
      'Job completed'
    );

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
    recordWorkerJobFailed(job.data.type, durationMs);

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
    startedAtByJob.delete(jobId);
    recordWorkerJobStalled();
    void jobService.onJobStalled(jobId).catch((error) => {
      logger.error({ error, jobId }, 'Failed to persist stalled event');
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Worker shutdown signal received');

    try {
      await worker.close();
      await Promise.all([closeMetricsServer(metricsServer), closeRedisConnection(), closeDbPool()]);
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
};

void start().catch((error) => {
  logger.error({ error }, 'Worker failed to start');
  process.exit(1);
});
