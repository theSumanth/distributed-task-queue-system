import { setTimeout as sleep } from 'node:timers/promises';

import { enqueueJob } from '@/core/queue/queue.producer';
import { outboxJobEnqueueSchema } from '@/api/schemas/job.schema';
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
  await withTransaction(async (client) => {
    const events = await outboxRepository.getPendingWithLock(BATCH_SIZE, client);

    for (const event of events) {
      try {
        if (event.attempts >= MAX_ATTEMPTS) {
          await outboxRepository.markFailedWithAttempts(
            event.id,
            event.attempts,
            MAX_ATTEMPTS,
            'max attempts reached',
            client
          );
          continue;
        }

        if (!shouldRetry(event.attempts, event.created_at)) {
          continue;
        }

        if (event.type === 'job.enqueue') {
          const payload = outboxJobEnqueueSchema.parse(event.payload);

          await enqueueJob(payload.jobId, {
            ...payload,
            priority: payload.priority ?? 'normal',
            delayMs: payload.delayMs ?? 0,
            maxRetries: payload.maxRetries ?? 3,
          });
        }

        await outboxRepository.markProcessed(event.id, client);
      } catch (error) {
        const nextAttempts = event.attempts + 1;

        await outboxRepository.markFailedWithAttempts(
          event.id,
          nextAttempts,
          MAX_ATTEMPTS,
          error,
          client
        );

        console.error('[Outbox Worker] Failed event', {
          eventId: event.id,
          attempts: nextAttempts,
          error,
        });
      }
    }
  });
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
