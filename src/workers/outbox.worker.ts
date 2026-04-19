import { setTimeout as sleep } from 'node:timers/promises';

import { enqueueDeadLetter, enqueueJob } from '@/core/queue/queue.producer';
import { outboxDLQJobEnqueueSchema, outboxJobEnqueueSchema } from '@/api/schemas/job.schema';
import { outboxRepository } from '@/repositories';
import { config } from '@/config';
import { withTransaction } from '@/database/client';

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

  for (const event of events) {
    try {
      if (event.attempts >= MAX_ATTEMPTS) {
        await outboxRepository.markFailedWithAttempts(
          event.id,
          event.attempts,
          MAX_ATTEMPTS,
          'max attempts reached'
        );
        continue;
      }

      if (!shouldRetry(event.attempts, event.created_at)) {
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

          break;
        }

        default:
          console.warn('[Outbox Worker] Unknown event type:', event.type);
      }

      await outboxRepository.markProcessed(event.id);
    } catch (error) {
      const nextAttempts = event.attempts + 1;

      await outboxRepository.markFailedWithAttempts(event.id, nextAttempts, MAX_ATTEMPTS, error);

      console.error('[Outbox Worker] Failed event', {
        eventId: event.id,
        attempts: nextAttempts,
        error,
      });
    }
  }
};

const start = async (): Promise<void> => {
  console.log('[Outbox Worker] started');

  while (true) {
    try {
      await processOutbox();
    } catch (error) {
      console.error('[Outbox Worker] loop error', error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
};

void start();
