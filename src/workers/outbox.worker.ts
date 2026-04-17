import { setTimeout as sleep } from 'node:timers/promises';

import { enqueueJob } from '@/core/queue/queue.producer';
import { outboxJobEnqueueSchema } from '@/api/schemas/job.schema';
import { outboxRepository } from '@/repositories';
import { config } from '@/config';

const POLL_INTERVAL_MS = config.outbox.pollIntervalMs;
const BATCH_SIZE = config.outbox.batchSize;

const MAX_ATTEMPTS = config.outbox.maxAttempts;
const BACKOFF_BASE_MS = config.outbox.backoffBaseMs;

const shouldRetry = (attempts: number, createdAt: Date): boolean => {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempts); // exponential
  const nextAttemptTime = new Date(createdAt.getTime() + delay);

  return Date.now() >= nextAttemptTime.getTime();
};

const processOutbox = async (): Promise<void> => {
  const events = await outboxRepository.getPending(BATCH_SIZE);

  for (const event of events) {
    try {
      if (event.attempts >= MAX_ATTEMPTS) {
        await outboxRepository.markFailed(event.id);

        console.error('[Outbox Worker] Max attempts reached', {
          eventId: event.id,
        });

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

      await outboxRepository.markProcessed(event.id);
    } catch (error) {
      await outboxRepository.incrementAttempts(event.id);

      console.error('[Outbox Worker] Failed event', {
        eventId: event.id,
        attempts: event.attempts + 1,
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
