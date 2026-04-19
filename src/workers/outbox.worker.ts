import { setTimeout as sleep } from 'node:timers/promises';

import { enqueueDeadLetter, enqueueJob } from '@/core/queue/queue.producer';
import { outboxDLQJobEnqueueSchema, outboxJobEnqueueSchema } from '@/api/schemas/job.schema';
import { outboxRepository } from '@/repositories';
import { config } from '@/config';
import { withTransaction } from '@/database/client';
import { logger } from '@/core/logger';

const POLL_INTERVAL_MS = config.outbox.pollIntervalMs;
const BATCH_SIZE = config.outbox.batchSize;

const MAX_ATTEMPTS = config.outbox.maxAttempts;
const BACKOFF_BASE_MS = config.outbox.backoffBaseMs;

const shouldRetry = (attempts: number, createdAt: Date): boolean => {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempts);
  const nextAttemptTime = new Date(createdAt.getTime() + delay);

  return Date.now() >= nextAttemptTime.getTime();
};

const processOutbox = async (): Promise<void> => {
  const events = await withTransaction(async (client) => {
    return outboxRepository.getPendingWithLock(BATCH_SIZE, client);
  });

  if (events.length === 0) {
    logger.debug('Outbox poll: no pending events');
    return;
  }

  logger.info(
    {
      batchSize: events.length,
    },
    'Outbox batch fetched'
  );

  for (const event of events) {
    const start = Date.now();

    try {
      logger.debug(
        {
          eventId: event.id,
          type: event.type,
          attempts: event.attempts,
        },
        'Processing outbox event'
      );

      if (event.attempts >= MAX_ATTEMPTS) {
        await outboxRepository.markFailedWithAttempts(
          event.id,
          event.attempts,
          MAX_ATTEMPTS,
          'max attempts reached'
        );

        logger.warn(
          {
            eventId: event.id,
          },
          'Outbox event exceeded max attempts'
        );

        continue;
      }

      if (!shouldRetry(event.attempts, event.created_at)) {
        logger.debug(
          {
            eventId: event.id,
            attempts: event.attempts,
          },
          'Skipping event due to backoff'
        );
        continue;
      }

      switch (event.type) {
        case 'job.enqueue': {
          const payload = outboxJobEnqueueSchema.parse(event.payload);

          await enqueueJob(payload.jobId, {
            ...payload,
            priority: payload.priority ?? 'normal',
            delayMs: payload.delayMs ?? 0,
            maxRetries: payload.maxRetries ?? 3,
          });

          logger.info(
            {
              eventId: event.id,
              jobId: payload.jobId,
              type: payload.type,
            },
            'Outbox job enqueued'
          );

          break;
        }

        case 'job.dead_letter': {
          const payload = outboxDLQJobEnqueueSchema.parse(event.payload);

          await enqueueDeadLetter({
            jobId: payload.jobId,
            payload: payload.payload,
            maxRetries: payload.maxRetries,
            type: payload.type,
          });

          logger.info(
            {
              eventId: event.id,
              jobId: payload.jobId,
              type: payload.type,
            },
            'Outbox DLQ job enqueued'
          );

          break;
        }

        default:
          logger.warn(
            {
              eventId: event.id,
              type: event.type,
            },
            'Unknown outbox event type'
          );
      }

      await outboxRepository.markProcessed(event.id);

      logger.debug(
        {
          eventId: event.id,
          durationMs: Date.now() - start,
        },
        'Outbox event processed'
      );
    } catch (error) {
      const nextAttempts = event.attempts + 1;

      await outboxRepository.markFailedWithAttempts(event.id, nextAttempts, MAX_ATTEMPTS, error);

      logger.error(
        {
          eventId: event.id,
          attempts: nextAttempts,
          error,
        },
        'Outbox event failed'
      );
    }
  }
};

const start = async (): Promise<void> => {
  logger.info(
    {
      pollInterval: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      maxAttempts: MAX_ATTEMPTS,
    },
    'Outbox Worker started'
  );

  while (true) {
    try {
      await processOutbox();
    } catch (error) {
      logger.error({ error }, 'Outbox worker loop error');
    }

    await sleep(POLL_INTERVAL_MS);
  }
};

void start();
